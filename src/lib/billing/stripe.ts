import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Accès minimal à l'API Stripe par fetch (pas de SDK) : création de sessions de paiement,
 * portail client, vérification de la signature des webhooks.
 */

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** Encode un objet imbriqué au format attendu par Stripe : a[b][0][c]=… */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  const walk = (v: unknown, key: string) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${key}[${i}]`));
    else if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, key ? `${key}[${k}]` : k);
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  };
  walk(obj, prefix);
  return parts.join("&");
}

export async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, unknown>, method = "POST"): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY manquant");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : formEncode(params ?? {}),
  });
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${res.status} : ${data.error?.message ?? "erreur"}`);
  return data;
}

/** Vérifie l'en-tête Stripe-Signature (HMAC-SHA256, tolérance de 5 minutes). */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), tolerance = 300): boolean {
  if (!header || !secret) return false;
  const items = header.split(",").map((p) => p.split("=") as [string, string]);
  const t = Number(items.find(([k]) => k === "t")?.[1]);
  const sigs = items.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isFinite(t) || !sigs.length || Math.abs(nowSec - t) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  return sigs.some((s) => {
    const b = Buffer.from(s, "hex");
    return b.length === expected.length && timingSafeEqual(b, expected);
  });
}

/** Signature valide pour un contenu donné (utilisée par les tests). */
export function signStripePayload(payload: string, secret: string, t = Math.floor(Date.now() / 1000)): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
}

type SubStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

/** Statuts Stripe → statuts de la base. */
export function mapSubscriptionStatus(s: string): SubStatus {
  switch (s) {
    case "trialing":
    case "active":
    case "past_due":
    case "canceled":
    case "incomplete":
      return s;
    case "unpaid":
      return "past_due";
    default: // incomplete_expired, paused, inconnu
      return "canceled";
  }
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  current_period_start?: number;
  current_period_end?: number;
  items?: { data?: { current_period_start?: number; current_period_end?: number; price?: { recurring?: { interval?: string } } }[] };
}

/** Extrait ce que l'on stocke d'un objet abonnement (les dates ont changé de place selon la version d'API). */
export function readSubscription(sub: StripeSubscription) {
  const item = sub.items?.data?.[0];
  const start = sub.current_period_start ?? item?.current_period_start;
  const end = sub.current_period_end ?? item?.current_period_end;
  return {
    userId: sub.metadata?.user_id ?? null,
    customer: sub.customer,
    id: sub.id,
    plan: item?.price?.recurring?.interval === "year" ? ("yearly" as const) : ("monthly" as const),
    status: mapSubscriptionStatus(sub.status),
    start: start ? new Date(start * 1000) : null,
    end: end ? new Date(end * 1000) : null,
    cancel: Boolean(sub.cancel_at_period_end),
  };
}
