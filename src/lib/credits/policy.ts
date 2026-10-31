/**
 * Règles de consommation : crédits pour les comptes gratuits,
 * usage raisonnable (plafonds mensuels invisibles) pour les abonnés Premium.
 * Les valeurs viennent de la table settings (modifiables en administration).
 */

export type UsageKind = "message" | "photo" | "search" | "voice_minute" | "video_minute" | "classifier" | "places";

export type CreditCost = Record<UsageKind, number>;

export interface PremiumCaps {
  repair: number;
  photo: number;
  search: number;
  voice_minute: number;
  video_minute: number;
}

export const DEFAULT_CREDIT_COST: CreditCost = {
  message: 2,
  photo: 3,
  search: 3,
  voice_minute: 5,
  video_minute: 10,
  classifier: 0,
  places: 0,
};

export const DEFAULT_PREMIUM_CAPS: PremiumCaps = {
  repair: 20,
  photo: 60,
  search: 30,
  voice_minute: 20,
  video_minute: 10,
};

/** Seuil d'affichage du message doux « vous approchez de la limite ». */
export const SOFT_WARNING_RATIO = 0.8;

export type Decision =
  | { allowed: true; credits: number; warning?: string }
  | { allowed: false; reason: "insufficient_credits" | "premium_cap"; message: string };

export interface UsageContext {
  premium: boolean;
  balance: number;
  /** Consommation du mois en cours pour ce type (abonnés). */
  monthUsage: number;
  /** Nombre de dépannages créés ce mois (abonnés), si l'action en crée un. */
  monthRepairs?: number;
  createsRepair?: boolean;
}

const LABELS: Record<Exclude<UsageKind, "classifier" | "message" | "places">, string> = {
  photo: "photos",
  search: "recherches de tutoriels",
  voice_minute: "minutes de conversation vocale",
  video_minute: "minutes de vidéo en direct",
};

/**
 * Décide si l'action est permise.
 * @param quantity nombre d'unités (minutes pour la voix et la vidéo, sinon 1)
 */
export function decide(
  kind: UsageKind,
  quantity: number,
  ctx: UsageContext,
  cost: CreditCost = DEFAULT_CREDIT_COST,
  caps: PremiumCaps = DEFAULT_PREMIUM_CAPS,
): Decision {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("quantity must be > 0");

  if (ctx.premium) {
    if (ctx.createsRepair && ctx.monthRepairs !== undefined && ctx.monthRepairs >= caps.repair) {
      return {
        allowed: false,
        reason: "premium_cap",
        message: `Vous avez ouvert ${caps.repair} dépannages ce mois-ci, la limite de l'usage raisonnable. Vous pouvez continuer vos dépannages en cours ; la limite repart le 1er du mois.`,
      };
    }
    if (kind === "message" || kind === "classifier" || kind === "places") return { allowed: true, credits: 0 };
    const cap = caps[kind];
    if (ctx.monthUsage + quantity > cap) {
      return {
        allowed: false,
        reason: "premium_cap",
        message: `Vous avez utilisé vos ${cap} ${LABELS[kind]} du mois. La limite repart le 1er du mois ; l'écrit reste disponible, et vous pouvez acheter un pack de crédits.`,
      };
    }
    const ratio = (ctx.monthUsage + quantity) / cap;
    return ratio >= SOFT_WARNING_RATIO
      ? { allowed: true, credits: 0, warning: `Vous avez utilisé ${Math.round(ratio * 100)} % de vos ${LABELS[kind]} du mois.` }
      : { allowed: true, credits: 0 };
  }

  const credits = Math.ceil(cost[kind] * quantity);
  if (credits > ctx.balance) {
    return {
      allowed: false,
      reason: "insufficient_credits",
      message: `Il vous reste ${ctx.balance} crédits, cette action en demande ${credits}. Passez à Premium (2,99 €/mois) ou achetez un pack de crédits.`,
    };
  }
  return { allowed: true, credits };
}

/** Durée (en minutes entières facturables) restante pour une session temps réel. */
export function realtimeMinutesAllowed(
  kind: "voice_minute" | "video_minute",
  ctx: UsageContext,
  sessionCapMinutes: number,
  cost: CreditCost = DEFAULT_CREDIT_COST,
  caps: PremiumCaps = DEFAULT_PREMIUM_CAPS,
): number {
  const byBudget = ctx.premium
    ? Math.floor(caps[kind] - ctx.monthUsage)
    : Math.floor(ctx.balance / cost[kind]);
  return Math.max(0, Math.min(sessionCapMinutes, byBudget));
}
