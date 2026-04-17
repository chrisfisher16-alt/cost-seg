/**
 * Canonical Anthropic model IDs used across the pipeline. See ADR 0005.
 *
 * Change a model = bump the corresponding prompt version (see §7).
 * Every AI call must record its resolved model string in `AiAuditLog.model`.
 */
export const MODELS = {
  classifyDocument: "claude-sonnet-4-6",
  decomposePurchasePrice: "claude-opus-4-7",
  classifyAssets: "claude-opus-4-7",
  draftNarrative: "claude-opus-4-7",
  retryFallback: "claude-haiku-4-5-20251001",
} as const;

export type AiOperation = keyof typeof MODELS;
