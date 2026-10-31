import { z } from "zod";
import { sql } from "@/lib/db";
import { errorResponse, HttpError, logout, requireUser } from "@/lib/auth";
import { stripe, stripeConfigured } from "@/lib/billing/stripe";

const Body = z.object({ confirm: z.literal("SUPPRIMER") });

/** Suppression définitive du compte et de ses données (RGPD). */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const p = Body.safeParse(await req.json().catch(() => null));
    if (!p.success) throw new HttpError(400, "Tapez SUPPRIMER pour confirmer.");
    // Résiliation immédiate des abonnements en cours avant d'effacer le compte.
    const subs = await sql<{ stripe_subscription_id: string }[]>`
      select stripe_subscription_id from subscriptions
      where user_id = ${user.id} and status in ('active', 'trialing', 'past_due') and stripe_subscription_id is not null`;
    if (subs.length && stripeConfigured()) {
      for (const s of subs) await stripe(`subscriptions/${s.stripe_subscription_id}`, undefined, "DELETE");
    }
    await sql`update subscriptions set status = 'canceled', updated_at = now() where user_id = ${user.id}`;
    await sql`select delete_user_data(${user.id})`;
    await logout();
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
