/**
 * Per-model unit economics. Values are USD per 1M tokens as of April 2026.
 * Update when Anthropic publishes revised pricing.
 *
 * Anthropic also exposes `usage.cache_creation_input_tokens` and
 * `usage.cache_read_input_tokens`; we don't use prompt caching in V1, so
 * we only need the base input/output rates.
 */
export interface ModelRates {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export const MODEL_RATES: Record<string, ModelRates> = {
  "claude-opus-4-7": { inputUsdPerMillion: 15, outputUsdPerMillion: 75 },
  "claude-sonnet-4-6": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-haiku-4-5-20251001": { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 },
};

export function computeCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_RATES[model];
  if (!rates) return 0;
  return (
    (tokensIn * rates.inputUsdPerMillion) / 1_000_000 +
    (tokensOut * rates.outputUsdPerMillion) / 1_000_000
  );
}
