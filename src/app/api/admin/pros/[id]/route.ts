import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth";
import { sendProReviewEmail } from "@/lib/email";

const Body = z.object({ status: z.enum(["pending", "verified", "suspended"]), note: z.string().trim().max(500).optional() });

/** Validation ou suspension d'une fiche artisan. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Fiche introuvable.");
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Statut invalide.");
    const rows = await sql<{ id: string; email: string | null; company_name: string }[]>`
      update pros set status = ${p.data.status}, review_note = ${p.data.note || null}, reviewed_at = now(), updated_at = now()
      where id = ${id} returning id, email, company_name`;
    if (!rows.length) throw new HttpError(404, "Fiche introuvable.");
    await sql`insert into audit_logs (actor_id, action, target, details)
              values (${admin.id}, ${"pro_" + p.data.status}, ${id}, ${JSON.stringify({ note: p.data.note ?? null })}::text::jsonb)`;
    if (rows[0].email) {
      await sendProReviewEmail(rows[0].email, { company: rows[0].company_name, status: p.data.status, note: p.data.note })
        .catch((e) => console.error("E-mail artisan non envoyé", e));
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
