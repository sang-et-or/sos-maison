import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, requireUser } from "@/lib/auth";

const Body = z.object({ step: z.number().int().min(0).max(9), done: z.boolean() });

/** Coche ou décoche une étape d'une fiche de réparation. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const messageId = Number(id);
    if (!Number.isSafeInteger(messageId) || messageId <= 0) throw new HttpError(404, "Fiche introuvable");
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Étape invalide.");
    const [row] = await sql<{ done: number[] | null }[]>`
      select set_card_step(${user.id}, ${messageId}, ${p.data.step}::smallint, ${p.data.done}) as done`;
    if (!row?.done) throw new HttpError(404, "Fiche introuvable");
    return Response.json({ done: row.done });
  } catch (e) {
    return errorResponse(e);
  }
}
