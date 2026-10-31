import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

const Body = z.object({ current: z.string().max(200).optional(), password: z.string().max(200) });

/**
 * Choisir ou changer son mot de passe (connecté). L'ancien est demandé s'il existe, sauf juste après
 * un lien « mot de passe oublié » (session ouverte il y a moins de 15 minutes par ce lien).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Mot de passe manquant.");
    const problem = passwordProblem(p.data.password, user.email);
    if (problem) throw new HttpError(400, problem);
    const [row] = await sql<{ password_hash: string | null; via_link: boolean }[]>`
      select u.password_hash,
             exists (select 1 from login_tokens t where t.email = u.email and t.used_at > now() - interval '15 minutes') as via_link
      from users u where u.id = ${user.id}`;
    if (row.password_hash && !row.via_link && !(await verifyPassword(p.data.current ?? "", row.password_hash))) {
      throw new HttpError(403, "Mot de passe actuel incorrect.");
    }
    await sql`update users set password_hash = ${await hashPassword(p.data.password)}, password_set_at = now() where id = ${user.id}`;
    await sql`insert into audit_logs (actor_id, action, target) values (${user.id}, 'password_set', ${user.id})`;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
