import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { sendServiceRequestEmail } from "@/lib/email";
import { getOwnedRepair } from "@/lib/repairs";

const Body = z
  .object({
    proId: z.string().uuid(),
    repairId: z.string().uuid().optional(),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(20).regex(/^[0-9 +().-]{8,20}$/).optional().or(z.literal("")),
    email: z.string().trim().max(254).email().optional().or(z.literal("")),
    postalCode: z.string().regex(/^[0-9]{5}$/),
    message: z.string().trim().min(10).max(2000),
    consentShare: z.boolean().default(false),
  })
  .refine((b) => b.phone || b.email, { message: "Indiquez un téléphone ou un e-mail." });

const MAX_PER_DAY = 5;

/** Résumé du dépannage transmis à l'artisan, uniquement avec l'accord explicite de l'utilisateur. */
async function buildSummary(repairId: string): Promise<string> {
  const [r] = await sql<{ title: string; risk_level: number }[]>`select title, risk_level from repairs where id = ${repairId}`;
  const [card] = await sql<{ card: { titre: string; diagnostic: string } }[]>`
    select card from messages where repair_id = ${repairId} and card is not null order by id desc limit 1`;
  const lastUser = await sql<{ content: string }[]>`
    select content from messages where repair_id = ${repairId} and role = 'user' order by id desc limit 3`;
  const lines = [`Problème : ${r.title}`];
  if (card) lines.push(`Diagnostic proposé : ${card.card.diagnostic}`);
  if (r.risk_level >= 3) lines.push("Intervention signalée comme réservée à un professionnel.");
  if (lastUser.length) lines.push(`Description du client : ${lastUser.reverse().map((m) => m.content).join(" / ").slice(0, 600)}`);
  return lines.join("\n");
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Formulaire incomplet.");
    const b = p.data;

    const [{ n }] = await sql<{ n: number }[]>`select requests_last_day(${user.id}) as n`;
    if (n >= MAX_PER_DAY) throw new HttpError(429, "Vous avez envoyé 5 demandes aujourd'hui. Réessayez demain.");

    const [pro] = await sql<{ id: string; email: string | null; company_name: string }[]>`
      select id, email, company_name from pros where id = ${b.proId} and status = 'verified'`;
    if (!pro) throw new HttpError(404, "Cet artisan n'est plus disponible.");

    let summary: string | null = null;
    if (b.repairId) {
      await getOwnedRepair(b.repairId, user.id);
      if (b.consentShare) summary = await buildSummary(b.repairId);
    }

    const [row] = await sql<{ id: string }[]>`
      insert into service_requests (user_id, pro_id, repair_id, contact_name, contact_phone, contact_email,
                                    postal_code, message, shared_summary, consent_share)
      values (${user.id}, ${pro.id}, ${b.repairId ?? null}, ${b.name}, ${b.phone || null}, ${b.email || null},
              ${b.postalCode}, ${b.message}, ${summary}, ${Boolean(summary)})
      returning id`;
    if (b.repairId) await sql`update repairs set status = 'needs_pro' where id = ${b.repairId} and status = 'open'`;

    if (pro.email) {
      await sendServiceRequestEmail(pro.email, {
        contactName: b.name, contactPhone: b.phone || null, contactEmail: b.email || null,
        postalCode: b.postalCode, message: b.message, summary,
      }).catch((e) => console.error("E-mail artisan non envoyé", e));
    }
    return Response.json({ ok: true, id: row.id, company: pro.company_name, emailed: Boolean(pro.email) });
  } catch (e) {
    return errorResponse(e);
  }
}
