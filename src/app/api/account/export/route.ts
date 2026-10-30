import { sql } from "@/lib/db";
import { errorResponse, requireUser } from "@/lib/auth";

/** Export RGPD : toutes les données du compte au format JSON (les photos sont listées, pas incluses). */
export async function GET() {
  try {
    const user = await requireUser();
    const [repairs, messages, equipment, ledger, requests, photos] = await Promise.all([
      sql`select id, title, status, risk_level, created_at, resolved_at from repairs where user_id = ${user.id}`,
      sql`select m.repair_id, m.role, m.content, m.created_at from messages m
          join repairs r on r.id = m.repair_id where r.user_id = ${user.id} order by m.id`,
      sql`select kind, brand, model, purchased_on, notes from equipment where user_id = ${user.id}`,
      sql`select delta, reason, balance_after, created_at from credit_ledger where user_id = ${user.id} order by id`,
      sql`select pro_id, message, shared_summary, status, created_at from service_requests where user_id = ${user.id}`,
      sql`select a.id, a.repair_id, a.created_at, a.expires_at from attachments a
          join repairs r on r.id = a.repair_id where r.user_id = ${user.id}`,
    ]);
    const data = { exported_at: new Date().toISOString(), account: user, repairs, messages, equipment, credits: ledger, service_requests: requests, photos };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": 'attachment; filename="sos-maison-mes-donnees.json"',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
