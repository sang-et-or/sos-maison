import { publicOrigin } from "@/lib/url";
import { sql, getSetting } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { stripe, stripeConfigured } from "@/lib/billing/stripe";

export const runtime = "nodejs";

const back = (base: string, q: string) => Response.redirect(`${base}/compte?${q}#premium`, 303);

/**
 * Ouvre une page de paiement Stripe. Appelée par un simple formulaire (fonctionne sans JavaScript).
 * offre = monthly | yearly | pack
 */
export async function POST(req: Request) {
  const base = publicOrigin(req);
  const user = await currentUser();
  if (!user) return Response.redirect(`${base}/connexion?next=/compte`, 303);
  if (!stripeConfigured()) return back(base, "paiement=indisponible");

  const form = await req.formData().catch(() => null);
  const offer = String(form?.get("offre") ?? "");
  if (!["monthly", "yearly", "pack"].includes(offer)) return back(base, "paiement=erreur");

  try {
    const [[{ premium }], [existing]] = await Promise.all([
      sql<{ premium: boolean }[]>`select is_premium(${user.id}) as premium`,
      sql<{ stripe_customer_id: string }[]>`select stripe_customer_id from subscriptions where user_id = ${user.id} order by updated_at desc limit 1`,
    ]);
    const customer = existing ? { customer: existing.stripe_customer_id } : { customer_email: user.email };
    const common = {
      ...customer,
      client_reference_id: user.id,
      locale: "fr",
      success_url: `${base}/compte?paiement=ok#premium`,
      cancel_url: `${base}/compte?paiement=annule#premium`,
    };

    let session: { url: string };
    if (offer === "pack") {
      const pack = await getSetting("credit_pack", { credits: 100, price_cents: 199 });
      session = await stripe("checkout/sessions", {
        ...common,
        mode: "payment",
        line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: pack.price_cents, product_data: { name: `${pack.credits} crédits SOS Maison` } } }],
        metadata: { kind: "pack", credits: pack.credits, user_id: user.id },
        payment_intent_data: { metadata: { kind: "pack", user_id: user.id } },
        custom_text: { submit: { message: "Crédits ajoutés dès le paiement validé, sans date d'expiration." } },
      });
    } else {
      if (premium) return back(base, "paiement=deja");
      const price = await getSetting("premium_price_cents", { monthly: 299, yearly: 2990 });
      const yearly = offer === "yearly";
      session = await stripe("checkout/sessions", {
        ...common,
        mode: "subscription",
        allow_promotion_codes: true,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: yearly ? price.yearly : price.monthly,
            recurring: { interval: yearly ? "year" : "month" },
            product_data: { name: yearly ? "SOS Maison Premium (annuel)" : "SOS Maison Premium (mensuel)" },
          },
        }],
        metadata: { kind: "premium", user_id: user.id },
        subscription_data: { metadata: { user_id: user.id } },
        custom_text: { submit: { message: "Sans engagement : résiliable à tout moment depuis « Mon espace », effet à la fin de la période payée." } },
      });
    }
    return Response.redirect(session.url, 303);
  } catch (e) {
    console.error(e);
    return back(base, "paiement=erreur");
  }
}
