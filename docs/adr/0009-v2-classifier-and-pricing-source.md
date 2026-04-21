# ADR 0009 — v2 Phase 2: per-object classify-assets + pricing source decision

Status: accepted, 2026-04-20

## Context

Phase 1 (ADR 0008) ships per-photo object detection. Phase 2 rewrites
Step C so the asset schedule is built from detected objects + improvement
receipts + closing-disclosure capitalized costs, one line item per object —
not ~12 category buckets as a fraction of building value. This is the
single biggest lever on output quality.

Two design problems need decisions:

1. **The sum-to-building-value constraint** the v1 classifier enforces
   forces the model to ratio-split arbitrary category percentages so the
   total matches. That's the wrong invariant when line items come from
   real observed objects with real comparable prices — the numbers will
   not line up to the exact dollar.

2. **The pricing source.** The benchmark references Craftsman 2025 unit
   costs and RSMeans. We do not license either data set. The master
   prompt's non-negotiables forbid fabricating Craftsman page numbers or
   RSMeans references.

## Decision

### Classifier rewrite (`classify-assets-v2`)

New prompt at `lib/ai/prompts/classify-assets-v2.ts`, new step at
`lib/ai/steps/classify-assets-v2.ts`, new Zod schema. Replaces the v1
classifier _only_ when `V2_REPORT_CLASSIFIER=1`.

New per-line-item fields (in addition to the v1 `category`, `name`,
`rationale`):

- `quantity` (number, units like "each" / "sq ft" / "lf") and `unit`.
- `source` enum: `craftsman | rsmeans | pricesearch | receipt`.
- `comparable`: `{ description, unitCostCents, sourceUrl? }`.
- `physicalMultiplier` (0.1–1.0) + `physicalJustification`
  (≥ one sentence grounded in the detected-object condition).
- `functionalMultiplier` (0.1–1.0) + `functionalJustification`.
- `timeMultiplier` (0.5–2.0) + `timeBasis`
  (e.g. "Building Cost Historical Index 2025 → 2022").
- `locationMultiplier` (0.5–2.0) + `locationBasis`
  (e.g. "Area Modification Factor for Austin, TX = 1.09").
- `adjustedCostCents` (integer, computed).
- `photoDocumentId` (UUID of the source photo; null for receipt- or CD-
  sourced items).
- `isResidual` (boolean; exactly one line item must have this set).

**Balancing — residual plug.** The orchestrator no longer forces the
model to hit building value to the cent. Instead:

1. Model returns N non-residual line items + one residual line item with
   `isResidual: true` whose category matches the property-type real-
   property class (27.5yr for residential, 39yr for STR/commercial).
2. Orchestrator overwrites the residual's `adjustedCostCents` to
   `buildingValueCents − Σ(non-residual adjustedCostCents)` exactly.
3. If the residual would go negative, treat as a balance failure and
   retry once with an over-allocation error message. This is the same
   retry shape v1 uses, just with a different invariant.

**Arithmetic verification.** Per non-residual line, the orchestrator
computes `expected = round(quantity × unitCostCents × physical ×
functional × time × location)` and checks the model-reported
`adjustedCostCents` is within 5 cents. Mismatches are a balance failure
(triggers the same retry).

**maxItems raised 40 → 300.** A benchmark-quality study has 80–180 items.

### Pricing source — honest disclosure

We do **not** license Craftsman 2025 or RSMeans. The non-negotiables
forbid fabricating page references. Our policy for this PR:

- `source: "receipt"` — for items sourced from the improvement
  spreadsheet or closing-disclosure capitalized costs. Unit cost equals
  the recorded expenditure. Multipliers all 1.0. `sourceUrl` optional
  (empty).
- `source: "pricesearch"` — for items estimated from detected-object
  photos. `comparable.description` must describe the specific item class
  ("24-inch chrome double towel bar, residential grade"), and
  `unitCostCents` must be a defensible 2025 retail estimate for that
  class. **No `sourceUrl`** is populated in this PR — we will not emit a
  URL we cannot verify is live and matches. Unit costs are the model's
  knowledge of 2025 retail pricing for common items.
- `source: "craftsman"` / `"rsmeans"` — **disallowed** by the prompt in
  this PR. The enum values remain in the schema so Phase 3 can enable
  them behind a real licensed-data integration.

The PDF's methodology appendix (rewritten in a later PR) will say
verbatim: "Unit-cost estimates for photo-detected items are the model's
internal 2025 retail price estimates for the item class; they are not
sourced from Craftsman, RSMeans, or any licensed pricing database. Items
sourced from receipts use recorded expenditure cost."

### Time + location multipliers

- **Time** uses the Craftsman Building Cost Historical Index series —
  specifically, the ratio `currentYearIndex / acquisitionYearIndex`.
  The series itself is public data; we embed the factors for
  2015–2026 in `lib/pricing/time-index.ts` (added in a later PR) or
  let the model cite a reasonable inflation series on its own for
  now. For this PR the model proposes `timeMultiplier` with a cited
  basis; validator checks it's inside [0.5, 2.0].
- **Location** uses Craftsman 2025 Area Modification Factors. Like
  time, we could embed the table (public), but for this PR we let
  the model cite a reasonable regional factor with justification.

These are acceptable trade-offs: the multiplier values live in a narrow
published range per geography, so validation guardrails catch obvious
abuse.

## Consequences

- Output shape breaks v1 compatibility. `Study.assetSchedule` now
  sometimes stores a v1 schedule and sometimes a v2. The finalize step
  stamps `schema: "v2"` into the stored JSON so downstream consumers
  (PDF renderer, admin surfaces) can branch. Existing studies keep v1.
- Step C cost rises: more line items × Opus 4.7 + per-item multipliers
  means more output tokens. Budget jumps from ~$0.15/study to ~$0.60/
  study. AiAuditLog cache still covers retries.
- PDF changes are NOT in this PR. Appendix B keeps rendering the same v1
  view; the v2 schedule is persisted but invisible until Phase 5 lands.
  Runbook: do not flip `V2_REPORT_CLASSIFIER=1` on prod without also
  flipping `V2_REPORT_PHOTOS=1`; the classifier hard-fails without
  `photoAnalysis` inputs when run on a property with photos.

## Rollback

Unset or set `V2_REPORT_CLASSIFIER=0`. Studies processed with the flag
on retain their v2 schedule in `Study.assetSchedule` but the PDF renders
them via the v1 path (the `schema` discriminator + a mapper).

## Out of scope (tracked for later phases)

- Phase 3: license Craftsman / RSMeans, or build a validated retailer-URL
  catalog so `pricesearch` items can carry real live URLs.
- Phase 4: parse CD capitalized costs (title insurance, recording, escrow)
  into line items. The v2 prompt accepts them as inputs but Step A does
  not yet extract them separately — punt until the enrich-property step
  lands.
- Phase 5: Appendix B per-asset gallery.
- Embedding the time-index and location-factor tables in
  `lib/pricing/*` for deterministic validation of the multipliers.
