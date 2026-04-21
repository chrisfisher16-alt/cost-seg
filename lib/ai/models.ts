/**
 * Canonical Anthropic model IDs used across the pipeline. See ADR 0005.
 *
 * Change a model = bump the corresponding prompt version (see §7).
 * Every AI call must record its resolved model string in `AiAuditLog.model`.
 */
export const MODELS = {
  classifyDocument: "claude-sonnet-4-6",
  // v2 Phase 1 vision pass. Sonnet is plenty for per-photo object
  // enumeration and ~5x cheaper than Opus; the bounded output shape
  // keeps quality stable.
  describePhotos: "claude-sonnet-4-6",
  // v2 Phase 4 property enrichment. Shallow reasoning once web_search
  // returns results — Sonnet is sufficient and 5× cheaper than Opus.
  enrichProperty: "claude-sonnet-4-6",
  // v2 Phase 7b QA review. Reads rendered PDF page images and catches
  // layout / content defects. Opus 4.7 because visual reasoning on
  // densely-typeset pages benefits from the bigger model. Cost is
  // bounded: the step runs at most once per study delivery.
  reviewReport: "claude-opus-4-7",
  decomposePurchasePrice: "claude-opus-4-7",
  classifyAssets: "claude-opus-4-7",
  draftNarrative: "claude-opus-4-7",
  retryFallback: "claude-haiku-4-5-20251001",
} as const;

export type AiOperation = keyof typeof MODELS;
