import "server-only";
import { sql } from "./db";

/** Trop d'échecs récents pour cet e-mail ou cette adresse IP ? (15 minutes glissantes) */
export async function tooManyFailures(email: string, ip: string | null): Promise<boolean> {
  const [{ by_email, by_ip }] = await sql<{ by_email: number; by_ip: number }[]>`
    select
      (select count(*)::int from login_attempts where email = ${email} and not ok and created_at > now() - interval '15 minutes') as by_email,
      (select count(*)::int from login_attempts where ip = ${ip} and not ok and created_at > now() - interval '15 minutes') as by_ip`;
  return by_email >= 8 || (ip !== null && by_ip >= 30);
}

export async function recordAttempt(email: string, ip: string | null, ok: boolean) {
  await sql`insert into login_attempts (email, ip, ok) values (${email}, ${ip}, ${ok})`;
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
}
