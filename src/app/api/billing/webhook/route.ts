import { sql } from "@/lib/db";
import { readSubscription, stripe, verifyStripeSignature, type StripeSubscription } from "@/lib/billing/stripe";

export const runtime = "nodejs";

interface StripeEvent { id: string; type: string; data: { object: Record<string, unknown> } }
/** Notifications Stripe : abonnements et achats de crédits. Chaque événement n'est traité qu'une fois. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
    return Response.json({ error: "signature invalide" }, { status: 400 });
  }
  const event = JSON.parse(payload) as StripeEvent;
  const obj = event.data.object;

  try {
    const result = await sql.begin(async (tx) => {
      const applySub = async (sub: StripeSubscription) => {
        const s = readSubscription(sub);
        let userId = s.userId;
        if (!userId) {
          const [row] = await tx<{ user_id: string }[]>`select user_id from subscriptions where stripe_customer_id = ${s.customer} limit 1`;
          userId = row?.user_id ?? null;
        }
        if (!userId) return "utilisateur inconnu";
        const [u] = await tx`select 1 from users where id = ${userId}`;
        if (!u) return "utilisateur inconnu";
        await tx`select apply_subscription(${userId}, ${s.customer}, ${s.id}, ${s.plan}::sub_plan, ${s.status}::sub_status,
                                           ${s.start}, ${s.end}, ${s.cancel})`;
        return "ok";
      };

      const fresh = await tx`insert into stripe_events (id, type) values (${event.id}, ${event.type}) on conflict do nothing returning id`;
      if (!fresh.length) return "déjà traité";

      if (event.type === "checkout.session.completed") {
        const meta = (obj.metadata ?? {}) as Record<string, string>;
        if (meta.kind === "pack" && obj.payment_status === "paid") {
          const credits = Number(meta.credits);
          if (!meta.user_id || !Number.isInteger(credits) || credits <= 0) return "pack invalide";
          const [u] = await tx`select 1 from users where id = ${meta.user_id} and deleted_at is null`;
          if (!u) return "utilisateur inconnu";
          await tx`select grant_credits(${meta.user_id}, ${credits}, ${"pack:" + String(obj.id)})`;
          return "crédits ajoutés";
        }
        if (obj.mode === "subscription" && typeof obj.subscription === "string") {
          const sub = await stripe<StripeSubscription>(`subscriptions/${obj.subscription}`, undefined, "GET");
          return applySub(sub);
        }
        return "ignoré";
      }
      if (event.type.startsWith("customer.subscription.")) {
        return applySub(obj as unknown as StripeSubscription);
      }
      return "ignoré";
    });
    return Response.json({ received: true, result });
  } catch (e) {
    console.error(e);
    // 500 : Stripe renverra l'événement plus tard (il n'a pas été marqué comme traité).
    return Response.json({ error: "traitement impossible" }, { status: 500 });
  }
}
