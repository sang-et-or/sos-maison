import { z } from "zod";

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const costs = z.object({
  message: int(0, 100), photo: int(0, 100), search: int(0, 100), voice_minute: int(0, 100),
  video_minute: int(0, 100), classifier: int(0, 100), places: int(0, 100).optional(),
}).strict();

/** Réglages modifiables depuis l'administration, avec leur format attendu. */
export const SETTING_SCHEMAS: Record<string, z.ZodTypeAny> = {
  welcome_credits: int(0, 1000),
  credit_cost: costs,
  premium_price_cents: z.object({ monthly: int(50, 10000), yearly: int(500, 100000) }).strict(),
  premium_monthly_caps: z.object({ repair: int(1, 1000), photo: int(0, 1000), search: int(0, 1000), voice_minute: int(0, 1000), video_minute: int(0, 1000) }).strict(),
  session_caps: z.object({ voice_minutes: int(1, 120), video_minutes: int(1, 120) }).strict(),
  attachment_retention_days: int(1, 3650),
  credit_pack: z.object({ credits: int(1, 10000), price_cents: int(50, 10000) }).strict(),
  google_search_daily_limit: int(0, 1000),
};

export function validateSetting(key: string, value: unknown): { ok: true } | { ok: false; error: string } {
  const schema = SETTING_SCHEMAS[key];
  if (!schema) return { ok: false, error: "Réglage inconnu." };
  const r = schema.safeParse(value);
  return r.success ? { ok: true } : { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || key} : ${i.message}`).join(" ; ") };
}

export interface AdminStats {
  users: number; users_7d: number; active_30d: number; premium: number; premium_yearly: number;
  repairs_month: number; resolved_month: number; emergencies_month: number; requests_month: number;
  pros_verified: number; pros_pending: number; cost_usd_month: number; credits_month: number; packs_month: number;
  cost_by_kind: Record<string, number>;
}

/** Chiffre d'affaires mensuel estimé (TTC, en centimes) à partir des abonnés actifs et des packs vendus. */
export function monthlyRevenueCents(s: Pick<AdminStats, "premium" | "premium_yearly" | "packs_month">, price: { monthly: number; yearly: number }, packCents: number) {
  const monthly = s.premium - s.premium_yearly;
  return Math.round(monthly * price.monthly + (s.premium_yearly * price.yearly) / 12 + s.packs_month * packCents);
}
