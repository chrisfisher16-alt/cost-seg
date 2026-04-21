# ADR 0012 — v2 Phase 5: PDF template — per-asset gallery + enrichment

Status: accepted, 2026-04-20

## Context

Phases 1–4 produce data the PDF can't yet render:

- Phase 1 → `Document.photoAnalysis` (captions, detected objects).
- Phase 2 → v2 asset schedule with per-line physical/functional
  justifications, time/location basis prose, comparable descriptions,
  and optional sourceUrl.
- Phase 4 → `Property.enrichmentJson` (assessor values, sqft, year
  built, construction type, listing URL).

The v1 PDF renderer (`components/pdf/AiReportTemplate.tsx`, 1,657
lines) has no knowledge of any of this. Until the PDF surfaces it, the
customer-visible output is unchanged — Phases 1–4 are invisible.

Two tensions shape this PR:

- **Full rewrite vs. additive.** The engineered benchmark is
  150–220 pages with a photo + six-multiplier block per asset. The
  v1 template is 31 pages. A full rewrite is weeks of work and high
  regression risk.
- **Photo embedding cost.** `@react-pdf/renderer`'s `<Image>`
  accepts remote URLs or base64 data URIs. Remote URLs let the PDF
  fetch at render time (smaller persisted PDF, but needs live URLs
  at open time). Data URIs inline the image bytes (larger PDF, but
  self-contained).

## Decision

This PR is an **additive slice** that makes v2 data visible without
rewriting the template:

1. **Data-URI-embedded photos.** Deliver.ts downloads each
   PROPERTY_PHOTO from Supabase Storage server-side, base64-encodes
   it, and passes `photoDataUri` on the matching line item. The
   persisted PDF is then self-contained — no render-time fetch,
   no signed-URL expiry issue. Total size with ~25 photos at ~200KB
   each sits under 10 MB, acceptable.

2. **Extend `AiReportProps` with optional v2 fields.** The existing
   props interface already anticipates `quantity` / `unitCostCents` /
   multipliers as optional. Add more optional fields on each line
   item:
   - `photoDataUri`, `unit`, `comparableDescription`,
     `comparableSourceUrl`
   - `physicalJustification`, `functionalJustification`,
     `timeBasis`, `locationBasis`
   - `isResidual`
     And a top-level optional `property.enrichment` block mirroring
     the `EnrichPropertyOutput` shape.

3. **Upgrade `AssetDetailCard` in place.** When the optional v2
   fields are present, render the photo thumbnail + a per-item
   adjustments section with paragraph justifications + a cost-
   summary line. When absent, render today's v1 chip layout
   unchanged. No new file; one component handles both shapes.

4. **Property Info page reads enrichment.** When
   `property.enrichment` is present, print sqft / year built /
   construction / roof / lot size from enrichment, falling back to
   intake values when a field is null. Always cite source URL(s)
   when rendered. No cover-page change in this PR (defer to a small
   follow-up).

5. **Deliver.ts owns the v2 → props mapping.** When the persisted
   `Study.assetSchedule.schema === "v2"`, deliver.ts:
   - Reads the v2 line items; maps `adjustedCostCents` → `amountCents`
     so MACRS + Form 3115 math is unchanged.
   - Loads `Document.photoAnalysis` + storage bytes for any photo
     referenced via `photoDocumentId`.
   - Loads `Property.enrichmentJson` and attaches it to props.
   - Gated by `V2_REPORT_PDF=1` so we can ship the mapping without
     flipping rendering on prod.

6. **Disclosure footer, MACRS math, Form 3115 worksheet, and
   Appendix C/D/E are untouched.** Phase 5 is Appendix B + Property
   Info only.

## Consequences

- Per-PDF size jumps ~5–10 MB when photos are embedded (vs. sub-1 MB
  today). Supabase Storage egress is the only cost and remains in the
  noise. Download UX is unchanged — most users open the PDF in a
  browser tab.
- Render time rises by the time to fetch + base64-encode each photo
  (~50–150ms × 25 photos ≈ 1–4s). Acceptable inside the existing
  deliver pipeline.
- v1 path is unchanged byte-for-byte when the flag is off.
- Page count stays near v1 for receipt-only studies; rises to
  roughly (# photos + residual) pages of Appendix B for fully-photo'd
  studies. Matching the 150–220 page benchmark isn't reached yet —
  that needs Phase 6 (narrative rewrite + appendix expansion).

## Rollback

Unset `V2_REPORT_PDF`. Deliver.ts skips the v2 mapping even for
studies with `schema: "v2"` in storage; PDF renders through the v1
code path as before.

## Out of scope

- Embedding the closing disclosure as rasterized pages in Appendix C.
  Requires a PDF-to-image step (pdf-lib + sharp, or an external
  service). Defer to Phase 6.
- Narrative rewrite so the Property Description prose weaves
  enrichment sqft / year built inline. Currently we add a dedicated
  "Property facts" block; the prose still reads as v1.
- Cover-page image (the benchmark shows a hero photo). Defer.
- Per-asset pagination discipline (one asset per page). Current
  `wrap={false}` on the card keeps items together; full benchmark
  layout lands in Phase 6.
