import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireAdmin } from "@/lib/auth";
import { validateSetting } from "@/lib/admin";

const Body = z.object({ key: z.string().max(64), value: z.unknown() });

/** Modifie un réglage (format vérifié, ancienne valeur conservée dans le journal). */
export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Requête invalide.");
    const v = validateSetting(p.data.key, p.data.value);
    if (!v.ok) throw new HttpError(400, v.error);
    const json = JSON.stringify(p.data.value);
    const [old] = await sql<{ value: unknown }[]>`select value from settings where key = ${p.data.key}`;
    await sql`insert into settings (key, value) values (${p.data.key}, ${json}::text::jsonb)
              on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await sql`insert into audit_logs (actor_id, action, target, details)
              values (${admin.id}, 'setting_update', ${p.data.key}, ${JSON.stringify({ before: old?.value ?? null, after: p.data.value })}::text::jsonb)`;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
