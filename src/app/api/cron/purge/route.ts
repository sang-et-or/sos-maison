import { sql } from "@/lib/db";

/** Tâche quotidienne (Vercel Cron) : purge des photos expirées et des jetons de connexion périmés. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const [{ n }] = await sql<{ n: number }[]>`select purge_expired_attachments() as n`;
  await sql`delete from login_tokens where expires_at < now() - interval '1 day'`;
  await sql`delete from sessions where expires_at < now()`;
  return Response.json({ photosPurged: n });
}
