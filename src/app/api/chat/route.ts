import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { chargeOrThrow } from "@/lib/usage";
import { createRepair, getOwnedRepair, listMessages } from "@/lib/repairs";
import { classifyText, combine, type RiskLevel } from "@/lib/safety/risk";
import { emergencyGuidance, proOnlyMessage } from "@/lib/safety/emergency";
import { classifyWithAI, runAssistant, type ChatTurn } from "@/lib/ai/assistant";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  repairId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
  photoIds: z.array(z.string().uuid()).max(4).default([]),
});

type Out =
  | { type: "repair"; repairId: string; title: string }
  | { type: "risk"; level: RiskLevel; pro?: string }
  | { type: "emergency"; guidance: ReturnType<typeof emergencyGuidance>; pro?: string }
  | { type: "pro"; category?: string; message: string }
  | { type: "balance"; balance: number | null; warning?: string }
  | { type: "error"; message: string; code?: string }
  | { type: "done" }
  | Record<string, unknown>;

export async function POST(req: Request) {
  let user;
  let body: z.infer<typeof Body>;
  try {
    user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Message invalide.");
    body = parsed.data;
  } catch (e) {
    return errorResponse(e);
  }

  // 1. Règles de sécurité déterministes : avant tout débit et tout appel à l'IA.
  const rules = classifyText(body.text);
  const emergencyByRules = rules.level === 4;

  // 2. Dépannage existant ou nouveau, et débit du message (sauf urgence : jamais facturée).
  let repair;
  let charged = 0;
  let balanceInfo: { balance: number | null; warning?: string } | null = null;
  try {
    if (!emergencyByRules) {
      const c = await chargeOrThrow({
        userId: user.id,
        kind: "message",
        repairId: body.repairId ?? null,
        createsRepair: !body.repairId,
      });
      charged = c.credits;
      balanceInfo = { balance: c.balance, warning: c.warning };
    }
    repair = body.repairId ? await getOwnedRepair(body.repairId, user.id) : await createRepair(user.id, body.text);
  } catch (e) {
    return errorResponse(e);
  }
  const isNew = !body.repairId;
  const userId = user.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (o: Out) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        if (isNew) send({ type: "repair", repairId: repair.id, title: repair.title });
        if (balanceInfo) send({ type: "balance", ...balanceInfo });

        // 3. Deuxième avis par l'IA, puis niveau final (jamais en baisse).
        const ai = emergencyByRules ? undefined : await classifyWithAI(body.text, { userId, repairId: repair.id });
        const current = combine(rules, ai);
        const merged = combine(current, { level: repair.risk_level, hazards: [], pro: repair.pro_category ?? undefined });
        // Écran d'urgence seulement si CE message décrit une urgence ; sinon un dépannage
        // déjà passé en urgence reste en mode « professionnel requis » (aucun tutoriel).
        const risk =
          current.level === 4 ? current : { ...merged, level: Math.min(merged.level, 3) as RiskLevel };
        await sql`update repairs set risk_level = ${Math.max(risk.level, repair.risk_level)},
                    pro_category = coalesce(${risk.pro ?? null}, pro_category)
                  where id = ${repair.id}`;
        send({ type: "risk", level: risk.level, pro: risk.pro });

        const [userMsg] = await sql<{ id: number }[]>`
          insert into messages (repair_id, role, content, risk_level)
          values (${repair.id}, 'user', ${body.text}, ${risk.level}) returning id`;
        if (body.photoIds.length) {
          await sql`update attachments set message_id = ${userMsg.id}
                    where id in ${sql(body.photoIds)} and repair_id = ${repair.id} and message_id is null`;
        }

        // 4. Urgence : consignes fixes, aucune réponse générée, crédit remboursé si déjà débité.
        if (risk.level === 4) {
          if (charged > 0) {
            await sql`select grant_credits(${userId}, ${charged}, 'refund:emergency')`;
          }
          const guidance = emergencyGuidance(risk.hazards);
          const text =
            "**Votre sécurité d'abord.** Suivez les consignes affichées et appelez les secours si besoin. " +
            "Quand vous serez en sécurité, je pourrai vous aider à trouver un professionnel.";
          await sql`insert into messages (repair_id, role, content, risk_level)
                    values (${repair.id}, 'assistant', ${text}, 4)`;
          await sql`update repairs set status = 'needs_pro' where id = ${repair.id}`;
          send({ type: "emergency", guidance, pro: risk.pro });
          send({ type: "final", text, sources: [] });
          send({ type: "done" });
          return controller.close();
        }
        if (risk.level === 3) {
          send({ type: "pro", category: risk.pro, message: proOnlyMessage(risk.hazards) });
        }

        // 5. Historique + photos du message courant.
        const history = await listMessages(repair.id, 30);
        const photos = body.photoIds.length
          ? await sql<{ mime_type: string; bytes: Uint8Array }[]>`
              select mime_type, bytes from attachments
              where message_id = ${userMsg.id} and repair_id = ${repair.id} order by created_at`
          : [];
        const turns: ChatTurn[] = [];
        for (const m of history) {
          if (m.role === "system") continue;
          const isCurrent = m.id === userMsg.id;
          if (isCurrent && photos.length) {
            const content: Anthropic.ContentBlockParam[] = photos.map((p) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: p.mime_type as "image/jpeg" | "image/png" | "image/webp",
                data: Buffer.from(p.bytes).toString("base64"),
              },
            }));
            content.push({ type: "text", text: m.content });
            turns.push({ role: "user", content });
          } else {
            const prev = turns.at(-1);
            // L'API exige l'alternance des rôles : on fusionne deux messages consécutifs du même rôle.
            if (prev && prev.role === m.role && typeof prev.content === "string") {
              prev.content += "\n\n" + m.content;
            } else {
              turns.push({ role: m.role, content: m.content });
            }
          }
        }
        while (turns.length && turns[0].role !== "user") turns.shift();

        const [{ premium }] = await sql<{ premium: boolean }[]>`select is_premium(${userId}) as premium`;
        const equipment = await sql<{ label: string }[]>`
          select concat_ws(' ', kind, brand, model) as label from equipment where user_id = ${userId} limit 10`;

        // 6. Réponse en direct.
        for await (const ev of runAssistant({
          userId,
          repairId: repair.id,
          turns,
          risk: risk.level,
          premium,
          equipment: equipment.map((e) => e.label).join(", ") || undefined,
        })) {
          send(ev);
          if (ev.type === "final") {
            const [a] = await sql<{ id: number }[]>`
              insert into messages (repair_id, role, content, risk_level)
              values (${repair.id}, 'assistant', ${ev.text}, ${risk.level}) returning id`;
            for (const s of ev.sources) {
              await sql`insert into sources (repair_id, message_id, url, title, provider, is_video)
                        values (${repair.id}, ${a.id}, ${s.url}, ${s.title.slice(0, 300)}, 'brave', ${s.isVideo})`;
            }
          }
        }
        send({ type: "done" });
      } catch (e) {
        console.error(e);
        send({
          type: "error",
          message: e instanceof HttpError ? e.message : "L'assistant n'a pas pu répondre. Réessayez dans un instant.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
