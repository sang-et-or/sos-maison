import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, isValidEmail, openSession, setSessionCookie } from "@/lib/auth";
import { hashPassword, passwordProblem } from "@/lib/password";
import { clientIp } from "@/lib/ratelimit";

const Body = z.object({ email: z.string().max(254), password: z.string().max(200), acceptTerms: z.literal(true) });
const MAX_SIGNUPS_PER_IP_PER_DAY = 5;

/** Création de compte avec mot de passe : connecté tout de suite, 100 crédits offerts (une fois par e-mail). */
export async function POST(req: Request) {
  try {
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Merci d'indiquer votre e-mail, un mot de passe et d'accepter les conditions.");
    const email = p.data.email.trim().toLowerCase();
    if (!isValidEmail(email)) throw new HttpError(400, "Cette adresse e-mail ne semble pas valide.");
    const problem = passwordProblem(p.data.password, email);
    if (problem) throw new HttpError(400, problem);
    const ip = clientIp(req);

    const [existing] = await sql<{ id: string; has_password: boolean }[]>`
      select id, password_hash is not null as has_password from users where email = ${email} and deleted_at is null`;
    if (existing) {
      throw new HttpError(409, existing.has_password
        ? "Un compte existe déjà avec cette adresse : connectez-vous."
        : "Un compte existe déjà avec cette adresse, sans mot de passe. Utilisez « Mot de passe oublié » pour en choisir un.", "exists");
    }
    if (ip) {
      const [{ n }] = await sql<{ n: number }[]>`
        select count(*)::int as n from users where signup_ip = ${ip} and created_at > now() - interval '1 day'`;
      if (n >= MAX_SIGNUPS_PER_IP_PER_DAY) throw new HttpError(429, "Trop de comptes créés depuis cette connexion aujourd'hui. Réessayez demain.");
    }

    const hash = await hashPassword(p.data.password);
    const sessionId = await sql.begin(async (tx) => {
      const [u] = await tx<{ id: string }[]>`select id from upsert_user(${email})`;
      await tx`update users set password_hash = ${hash}, password_set_at = now(), signup_ip = ${ip},
                 consent_terms_at = now(), email_verified_at = null where id = ${u.id}`;
      return openSession(tx, u.id, email, req.headers.get("user-agent"));
    });
    await setSessionCookie(sessionId);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
