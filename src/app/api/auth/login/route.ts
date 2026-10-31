import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, openSession, setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { clientIp, recordAttempt, tooManyFailures } from "@/lib/ratelimit";

const Body = z.object({ email: z.string().max(254), password: z.string().max(200) });
const WRONG = "E-mail ou mot de passe incorrect.";

/** Connexion par e-mail et mot de passe. Même message d'erreur que le compte existe ou non. */
export async function POST(req: Request) {
  try {
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Indiquez votre e-mail et votre mot de passe.");
    const email = p.data.email.trim().toLowerCase();
    const ip = clientIp(req);
    if (await tooManyFailures(email, ip)) {
      throw new HttpError(429, "Trop d'essais. Patientez 15 minutes ou utilisez « Mot de passe oublié ».");
    }
    const [u] = await sql<{ id: string; password_hash: string | null }[]>`
      select id, password_hash from users where email = ${email} and deleted_at is null`;
    if (u && !u.password_hash) {
      await recordAttempt(email, ip, false);
      throw new HttpError(401, "Ce compte n'a pas encore de mot de passe. Touchez « Mot de passe oublié » pour en choisir un.", "no_password");
    }
    // Calcul effectué même si le compte n'existe pas (temps de réponse identique).
    const ok = await verifyPassword(p.data.password, u?.password_hash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
    await recordAttempt(email, ip, Boolean(u && ok));
    if (!u || !ok) throw new HttpError(401, WRONG, "wrong");
    const sessionId = await openSession(sql, u.id, email, req.headers.get("user-agent"));
    await setSessionCookie(sessionId);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
