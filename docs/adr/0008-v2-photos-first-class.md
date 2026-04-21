# ADR 0008 — v2 Phase 1: photos become first-class inputs

Status: accepted, 2026-04-20

## Context

The AI report today (see `docs/prompts/v2.0-engineered-quality-upgrade.md` and
the Edison-Street benchmark in `207SEdisonCostSeg.pdf`) caps at ~12 category-
level buckets — "Appliances — 3.00% of basis — $10,011" — because the asset
classifier (`lib/ai/steps/classify-assets.ts`) only sees the asset library
and the improvements spreadsheet. The uploaded photos never reach any model:
the Step A classifier produces a short prose description stored on
`Document.extractedJson.description`, and the classifier never reads it.

The $700 benchmark Appendix B has ~145 discrete, photographed line items
("chrome double towel bar above toilet," "wooden shower bench," "3-piece
hanging planter set"). That per-object specificity is the product. Closing
the gap starts with actually inspecting the photos.

This ADR covers Phase 1 of the v2 effort: a vision pass that enumerates
depreciable objects in each uploaded photo and persists them so the Phase 2
classifier rewrite can consume them.

## Decision

1. **New pipeline step — `describe-photos` (Step A2).** Runs once per
   PROPERTY_PHOTO upload, after Step A classification. Uses
   `claude-sonnet-4-6` via tool use. Produces:
   - `caption` — one-sentence scene description.
   - `roomType` — from a fixed 24-element vocabulary
     (kitchen / primary_bath / exterior_front / …).
   - `roomConfidence` — 0–1.
   - `detectedObjects[]` — each entry has `name`, `category` (18-element
     vocabulary), `quantity`, `condition` (excellent / good / fair / poor /
     salvage), and a one-sentence `conditionJustification`.
   - Optional free-text `notes`.

2. **Schema extension.** `Document` gets four nullable columns — `roomTag`
   (user-supplied hint), `imageWidth`, `imageHeight`, `photoAnalysis` (JSON).
   No new table; photo documents are already ordered via `Document.createdAt`
   and `kind = PROPERTY_PHOTO` gives a free filter. Migration is additive.

3. **Flag-gated rollout.** The new step runs only when
   `process.env.V2_REPORT_PHOTOS` is "1" or "true". Off path: the pipeline
   is byte-for-byte identical to v1. This matches the repo's existing
   flag pattern (`isStripeConfigured`, `isSupabaseConfigured`).

4. **Additive, not replacing.** Step A's photo description still runs and
   still populates `Document.extractedJson`. The new `photoAnalysis` column
   is a new, richer channel — nothing upstream changes, nothing downstream
   reads it yet. Phase 2 will.

5. **Model choice.** Sonnet, not Opus. Per-photo output is bounded (≤40
   detected objects × ~4 short strings each), the task is enumeration not
   reasoning, and Sonnet is ~5× cheaper. `lib/ai/models.ts` adds a
   dedicated `describePhotos` entry so we can dial the model independently
   of the document classifier.

## Consequences

- Adds one AI call per uploaded photo. At ~25 photos per study and
  ~$0.03/photo the marginal cost is ~$0.75/study — lost in the noise vs.
  the Opus narrative pass. AiAuditLog caching makes retries free.
- `Document.photoAnalysis` is the new source of truth for per-object
  data. Phase 2's classifier rewrite will deduplicate across photos (same
  dining table shot from two angles is one line item).
- No PDF template changes yet. Phase 5 renders detected objects in
  Appendix B.
- Schema migration is additive and backward compatible. Existing rows
  keep NULL; new photos get populated only when the flag is on.

## Rollback

Set `V2_REPORT_PHOTOS=0` (or unset) and the pipeline reverts to the v1
path. The schema columns are nullable and non-indexed; leaving them in
place is cost-free.

## Out of scope (tracked for Phase 2+)

- Cross-photo dedup of detected objects.
- Deciding the Craftsman / RSMeans / PriceSearch source for unit costs
  (see Phase 3 + a future ADR).
- Embedding photos into the PDF — that lands in Phase 5 along with the
  Appendix B rewrite.
