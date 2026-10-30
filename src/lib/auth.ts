import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "./db";

export const SESSION_COOKIE = "sm_session";
const SESSION_DAYS = 60;
const TOKEN_MINUTES = 15;
const MAX_TOKENS_PER_HOUR = 5;

export interface User {
  id: string;
  email: string;
  role: "user" | "pro" | "admin";
  display_name: string | null;
  postal_code: string | null;
  credit_balance: number;
  created_at: Date;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function isValidEmail(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(email.trim());
}

/**
 * Crée un jeton de connexion à usage unique (seul son hash est stocké).
 * Retourne null si trop de demandes récentes pour cet e-mail.
 */
export async function createLoginToken(email: string, ip: string | null): Promise<string | null> {
  const e = email.trim().toLowerCase();
  const [{ n }] = await sql<{ n: number }[]>`
    select count(*)::int as n from login_tokens
    where email = ${e} and created_at > now() - interval '1 hour'`;
  if (n >= MAX_TOKENS_PER_HOUR) return null;

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into login_tokens (token_hash, email, expires_at, ip)
    values (${sha256(token)}, ${e}, now() + ${`${TOKEN_MINUTES} minutes`}::interval, ${ip})`;
  return token;
}

/** Consomme un jeton et ouvre une session. Retourne l'identifiant de session, ou null. */
export async function consumeLoginToken(token: string, userAgent: string | null): Promise<string | null> {
  return sql.begin(async (tx) => {
    const rows = await tx<{ email: string }[]>`
      update login_tokens set used_at = now()
      where token_hash = ${sha256(token)} and used_at is null and expires_at > now()
      returning email`;
    if (!rows[0]) return null;
    const [user] = await tx<{ id: string }[]>`select id from upsert_user(${rows[0].email})`;
    // La demande de lien exige l'acceptation des CGU : on l'horodate.
    await tx`update users set consent_terms_at = coalesce(consent_terms_at, now()) where id = ${user.id}`;
    const admins =(process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(rows[0].email)) {
      await tx`update users set role = 'admin' where id = ${user.id}`;
    }
    const [session] = await tx<{ id: string }[]>`
      insert into sessions (user_id, expires_at, user_agent)
      values (${user.id}, now() + ${`${SESSION_DAYS} days`}::interval, ${userAgent?.slice(0, 300) ?? null})
      returning id`;
    return session.id;
  });
}

export async function setSessionCookie(sessionId: string) {
  (await cookies()).set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

/** Utilisateur connecté, ou null. */
export async function currentUser(): Promise<User | null> {
  const sid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sid || !/^[0-9a-f-]{36}$/i.test(sid)) return null;
  const rows = await sql<User[]>`
    select u.id, u.email, u.role, u.display_name, u.postal_code, u.credit_balance, u.created_at
    from sessions s join users u on u.id = s.user_id
    where s.id = ${sid} and s.expires_at > now() and u.deleted_at is null`;
  return rows[0] ?? null;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Connexion requise");
  return u;
}

export async function logout() {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (sid && /^[0-9a-f-]{36}$/i.test(sid)) await sql`delete from sessions where id = ${sid}`;
  jar.delete(SESSION_COOKIE);
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

/** Transforme une erreur en réponse JSON propre. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message, code: e.code }, { status: e.status });
  }
  console.error(e);
  return Response.json({ error: "Une erreur est survenue. Réessayez dans un instant." }, { status: 500 });
}
