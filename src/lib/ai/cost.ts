/**
 * Tarifs publiés (USD par million de tokens), relevés le 30/10/2026 sur
 * https://platform.claude.com/docs/en/about-claude/pricing — à mettre à jour si Anthropic change ses prix.
 */
export const MODELS = {
  chat: "claude-sonnet-5-5",
  fast: "claude-haiku-5-5",
} as const;

const PRICES: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function tokenCostUsd(model: string, u: TokenUsage): number {
  const p = PRICES[model];
  if (!p) return 0;
  const M = 1_000_000;
  return (
    (u.input_tokens * p.input +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      u.output_tokens * p.output) /
    M
  );
}

/** Brave Search : 5 $ / 1 000 requêtes. */
export const BRAVE_COST_PER_QUERY_USD = 0.005;
