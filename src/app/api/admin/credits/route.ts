import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth";

const Body = z.object({
  email: z.string().trim().toLowerCase().email(),
  amount: z.number().int().min(1).max(5000),
  reason: z.string().trim().min(3).max(120),
});

/** Geste commercial : ajoute des crédits à un compte. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, p.error.issues[0]?.message ?? "Formulaire invalide.");
    const [u] = await sql<{ id: string }[]>`select id from users where email = ${p.data.email} and deleted_at is null`;
    if (!u) throw new HttpError(404, "Aucun compte avec cet e-mail.");
    const [{ balance }] = await sql<{ balance: number }[]>`select grant_credits(${u.id}, ${p.data.amount}, ${"admin:" + p.data.reason}) as balance`;
    await sql`insert into audit_logs (actor_id, action, target, details)
              values (${admin.id}, 'grant_credits', ${u.id}, ${JSON.stringify({ amount: p.data.amount, reason: p.data.reason })}::text::jsonb)`;
    return Response.json({ ok: true, balance });
  } catch (e) {
    return errorResponse(e);
  }
}
