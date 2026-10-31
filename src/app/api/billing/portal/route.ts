import { sql } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { stripe, stripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";

/** Portail Stripe : moyen de paiement, factures, résiliation. */
export async function POST(req: Request) {
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const user = await currentUser();
  if (!user) return Response.redirect(`${base}/connexion?next=/compte`, 303);
  const [sub] = await sql<{ stripe_customer_id: string }[]>`
    select stripe_customer_id from subscriptions where user_id = ${user.id} order by updated_at desc limit 1`;
  if (!sub || !stripeConfigured()) return Response.redirect(`${base}/compte?paiement=indisponible#premium`, 303);
  try {
    const s = await stripe<{ url: string }>("billing_portal/sessions", { customer: sub.stripe_customer_id, return_url: `${base}/compte`, locale: "fr" });
    return Response.redirect(s.url, 303);
  } catch (e) {
    console.error(e);
    return Response.redirect(`${base}/compte?paiement=erreur#premium`, 303);
  }
}
