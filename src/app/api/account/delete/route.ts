import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, logout, requireUser } from "@/lib/auth";

const Body = z.object({ confirm: z.literal("SUPPRIMER") });

/** Suppression définitive du compte et de ses données (RGPD). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Tapez SUPPRIMER pour confirmer.");
    // TODO jalon 2 : résilier l'abonnement Stripe et anonymiser le client Stripe avant la suppression.
    await sql`select delete_user_data(${user.id})`;
    await logout();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
