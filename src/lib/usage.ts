import "server-only";
import { sql, getSetting } from "./db";
import { HttpError } from "./auth";
import {
  decide,
  DEFAULT_CREDIT_COST,
  DEFAULT_PREMIUM_CAPS,
  type CreditCost,
  type PremiumCaps,
  type UsageKind,
} from "./credits/policy";

export interface UsageCtx {
  premium: boolean;
  balance: number;
}

export async function loadPolicy() {
  const [cost, caps] = await Promise.all([
    getSetting<CreditCost>("credit_cost", DEFAULT_CREDIT_COST),
    getSetting<PremiumCaps>("premium_monthly_caps", DEFAULT_PREMIUM_CAPS),
  ]);
  return { cost, caps };
}

/**
 * Vérifie le droit d'agir puis débite les crédits (comptes gratuits).
 * Lève une HttpError 402 si refusé. Retourne un éventuel message d'avertissement doux.
 */
export async function chargeOrThrow(opts: {
  userId: string;
  kind: UsageKind;
  quantity?: number;
  repairId?: string | null;
  createsRepair?: boolean;
}): Promise<{ credits: number; warning?: string; balance: number | null }> {
  const quantity = opts.quantity ?? 1;
  const { cost, caps } = await loadPolicy();
  const [row] = await sql<{ premium: boolean; balance: number; usage: string; repairs: number }[]>`
    select is_premium(u.id) as premium, u.credit_balance as balance,
           month_usage(u.id, ${opts.kind}::usage_kind)::text as usage,
           month_repairs(u.id) as repairs
    from users u where u.id = ${opts.userId}`;
  if (!row) throw new HttpError(401, "Compte introuvable");

  const d = decide(
    opts.kind,
    quantity,
    {
      premium: row.premium,
      balance: row.balance,
      monthUsage: Number(row.usage),
      monthRepairs: row.repairs,
      createsRepair: opts.createsRepair,
    },
    cost,
    caps,
  );
  if (!d.allowed) throw new HttpError(402, d.message, d.reason);

  if (d.credits > 0) {
    const [{ bal }] = await sql<{ bal: number | null }[]>`
      select spend_credits(${opts.userId}, ${d.credits}, ${"usage:" + opts.kind}, ${opts.repairId ?? null}) as bal`;
    if (bal === null) {
      throw new HttpError(402, "Crédits insuffisants pour cette action.", "insufficient_credits");
    }
    return { credits: d.credits, warning: d.warning, balance: bal };
  }
  return { credits: 0, warning: d.warning, balance: row.premium ? null : row.balance };
}

/** Enregistre le coût réel d'un appel fournisseur (tableau de bord de marge). */
export async function recordUsage(e: {
  userId: string | null;
  repairId?: string | null;
  kind: UsageKind;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  quantity?: number;
  costUsd: number;
  credits?: number;
}) {
  await sql`
    insert into usage_events (user_id, repair_id, kind, provider, model, input_tokens, output_tokens,
                              cached_tokens, quantity, cost_usd, credits)
    values (${e.userId}, ${e.repairId ?? null}, ${e.kind}, ${e.provider}, ${e.model ?? null},
            ${e.inputTokens ?? 0}, ${e.outputTokens ?? 0}, ${e.cachedTokens ?? 0},
            ${e.quantity ?? 1}, ${e.costUsd}, ${e.credits ?? 0})`;
}
