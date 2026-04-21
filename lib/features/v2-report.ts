import "server-only";

/**
 * v2 report upgrade feature flags. The v2 effort (see
 * `docs/prompts/v2.0-engineered-quality-upgrade.md`) rolls out across
 * several phases; each one ships behind an env flag so we can enable
 * phases independently on preview/prod.
 *
 * Flag style matches the rest of the repo (`isStripeConfigured`,
 * `isSupabaseConfigured`) — a simple predicate on process.env that
 * callers wrap their new-path logic behind.
 *
 * A flag is ON iff the env var is set to exactly "1" or "true" (case
 * insensitive). Anything else — unset, "0", "false", empty string — is OFF.
 */

function readBooleanFlag(envVar: string): boolean {
  const raw = process.env[envVar];
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

/**
 * Phase 1 flag — when ON, the pipeline runs an extra vision pass per
 * uploaded photo (`describe-photos`) and persists structured caption
 * + detected-object output on `Document.photoAnalysis`. Phase 2 will
 * consume this data. When OFF, photo uploads are handled exactly as
 * they were before v2 (Step A classifies with a short description and
 * nothing else).
 */
export function isV2PhotosEnabled(): boolean {
  return readBooleanFlag("V2_REPORT_PHOTOS");
}

/**
 * Phase 2 flag — when ON, Step C uses the v2 classifier
 * (`classify-assets-v2`) which builds a per-object schedule from the
 * detected-object output of Phase 1 + improvement receipts + CD items.
 * Requires Phase 1 data; flipping this without Phase 1 hard-fails on
 * properties with photo uploads. See ADR 0009.
 */
export function isV2ClassifierEnabled(): boolean {
  return readBooleanFlag("V2_REPORT_CLASSIFIER");
}

/**
 * Phase 3 flag — when ON, the v2 classifier authorizes Anthropic's
 * server-side `web_search_20250305` tool during Step C so the model
 * can populate `comparable.sourceUrl` with live retailer URLs. Implies
 * `V2_REPORT_CLASSIFIER` (flipping this without Phase 2 is a no-op).
 * See ADR 0010.
 */
export function isV2WebSearchEnabled(): boolean {
  return readBooleanFlag("V2_REPORT_WEB_SEARCH");
}

/**
 * Phase 4 flag — when ON, the pipeline runs a new `enrich-property`
 * step before Step A that looks up assessor + listing data via
 * web_search and persists it on `Property.enrichmentJson`, and Step B
 * consumes the assessor land/total ratio as rule #2 in land allocation.
 * See ADR 0011.
 */
export function isV2PropertyEnrichEnabled(): boolean {
  return readBooleanFlag("V2_REPORT_PROPERTY_ENRICH");
}

/**
 * Phase 5 flag — when ON, the deliver step maps a v2 `assetSchedule`
 * (schema === "v2") into the AiReportProps shape with embedded photo
 * data URIs, pulls enrichment from `Property.enrichmentJson`, and the
 * PDF renders the upgraded per-asset layout. Off path: PDF renders
 * via the v1 template with v1-shaped data even if the schedule was
 * produced by the v2 classifier. See ADR 0012.
 */
export function isV2PdfEnabled(): boolean {
  return readBooleanFlag("V2_REPORT_PDF");
}

/**
 * Phase 7b flag — when ON, the deliver step rasterizes the rendered
 * PDF and runs the vision-model review step (`review-report`) before
 * uploading / emailing. Findings are logged to StudyEvent regardless
 * of enforce mode. See ADR 0013.
 */
export function isV2ReviewEnabled(): boolean {
  return readBooleanFlag("V2_REPORT_REVIEW");
}

/**
 * Phase 7b enforce flag — when ON (and `V2_REPORT_REVIEW` is also on),
 * any severity=blocker finding short-circuits delivery: the PDF is
 * NOT uploaded, no email goes out, and a `pipeline.review_failed`
 * StudyEvent fires so ops can inspect and re-trigger. When OFF,
 * findings are logged but delivery proceeds regardless. See ADR 0013.
 */
export function isV2ReviewEnforceEnabled(): boolean {
  return readBooleanFlag("V2_REPORT_REVIEW_ENFORCE");
}
