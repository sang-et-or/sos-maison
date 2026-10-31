import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";
import { REQUEST_STATUS } from "@/lib/pros";

const Body = z.object({ status: z.enum(REQUEST_STATUS) });

/** L'artisan fait avancer une demande reçue (vue, acceptée, refusée, terminée). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Demande introuvable.");
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Statut invalide.");
    const rows = await sql`
      update service_requests r set status = ${p.data.status}
      from pros p
      where r.id = ${id} and r.pro_id = p.id and p.user_id = ${user.id}
      returning r.id`;
    if (!rows.length) throw new HttpError(404, "Demande introuvable.");
    return Response.json({ ok: true, status: p.data.status });
  } catch (e) {
    return errorResponse(e);
  }
}
