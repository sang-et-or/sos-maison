import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { getOwnedRepair } from "@/lib/repairs";

const Patch = z.object({
  status: z.enum(["open", "resolved", "needs_pro", "abandoned"]).optional(),
  keep: z.boolean().optional(),
  title: z.string().trim().min(1).max(70).optional(),
});

/** Marquer résolu, demander un pro, garder le dépannage (photos conservées), renommer. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const repair = await getOwnedRepair(id, user.id);
    const p = Patch.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Modification invalide.");
    const { status, keep, title } = p.data;
    await sql`
      update repairs set
        status = coalesce(${status ?? null}::repair_status, status),
        keep = coalesce(${keep ?? null}::boolean, keep),
        title = coalesce(${title ?? null}, title),
        resolved_at = case when ${status ?? null}::text = 'resolved' then now() else resolved_at end
      where id = ${repair.id}`;
    if (keep) await sql`update attachments set expires_at = null where repair_id = ${repair.id}`;
    if (status === "resolved") {
      // Économie estimée = prix d'artisan indiqué par la dernière fiche de réparation.
      await sql`
        update repairs set estimated_saving_eur = (
          select least(greatest((m.card ->> 'economie_estimee_eur')::int, 0), 2000)
          from messages m where m.repair_id = ${repair.id} and m.card ? 'economie_estimee_eur'
          order by m.id desc limit 1)
        where id = ${repair.id}`;
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const repair = await getOwnedRepair(id, user.id);
    await sql`delete from repairs where id = ${repair.id}`;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
