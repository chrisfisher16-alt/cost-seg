# ADR 0011 — v2 Phase 4: property enrichment via public records

Status: accepted, 2026-04-20

## Context

The v1 cost-seg report fills Property Description with "Square footage
and year built were not provided" and its land allocation falls back to
"Rule 3: 30% midpoint" even when the county assessor has a published
ratio. The benchmark engineered study for 207 S Edison pulls:

- 2,197 sq ft, built 1920, wood-frame + metal roof, detached garage,
  7,884 sq ft lot (from a Redfin listing).
- $155,080 assessor land value / $536,000 assessor total = 28.93% land
  allocation, applied to the $393,503 purchase price → $113,852 land.
  Source URL cited in the report:
  `https://www.redfin.com/TX/Fredericksburg/207-S-Edison-St-.../home/128992219`.

Both facts are public. Both materially improve the report. The v1
pipeline ignores them because nothing fetches them.

## Decision

1. **New step — `enrich-property`.** Runs after `mark-processing`,
   before `step-a-classify-documents`. Takes the address, uses the
   Anthropic `web_search_20250305` server tool (infrastructure landed
   in ADR 0010) with a domain allowlist tuned for assessor + listing
   sources, and produces a structured `EnrichProperty` output:

   ```
   {
     squareFeet, yearBuilt, bedrooms, bathrooms,
     constructionType, roofType, lotSizeSqft,
     assessorLandValueCents, assessorTotalValueCents, assessorTaxYear,
     assessorUrl, listingUrl,
     confidence: { overall, assessor, listing }
   }
   ```

2. **Domain allowlist for enrichment search.** Broader than the
   Phase 3 pricing allowlist:
   - `*.gov` — county / state assessor portals live here
     (e.g. `gillespiecad.org` is `.org`, Harris County is
     `hcad.org`, many others are `.gov` or `.us`).
   - `*.us` — another common assessor TLD.
   - `redfin.com`, `zillow.com`, `realtor.com`, `trulia.com` —
     listing aggregators that carry sqft / year-built.
   - `*.org` — many assessor districts use `.org`; tolerate it and
     let the model filter via prompt discipline.

   No `.com` allowlist beyond the four listing services — we don't
   want the model scraping SEO-farm real-estate blogs.

3. **Persisted on `Property.enrichmentJson`.** New nullable JSON
   column. Additive migration. No table; the Property row already
   exists one-to-many with Study.

4. **Step B consumes enrichment when present.** The
   `decompose-price` prompt + step signature gain an optional
   `enrichment` input. The system prompt adds the authoritative rule
   order:
   1. Closing-disclosure allocation if present (unchanged).
   2. **NEW**: Assessor ratio (`landValueCents / totalValueCents`)
      applied to purchase price when both values are present.
   3. Market-rule fallback (unchanged).
      Methodology prose must cite the assessor URL when rule 2 applies.

5. **Flag-gated.** `V2_REPORT_PROPERTY_ENRICH=1` turns on the step
   and the Step B assessor-ratio rule. Off path: decompose-price
   runs identical to today.

6. **Model.** Sonnet 4.6. The output shape is bounded and the
   reasoning work is shallow once web_search returns results; Opus
   would be overkill at 5× the token cost.

7. **URLs are never fabricated.** Same rule as ADR 0010:
   `assessorUrl` / `listingUrl` are populated only when web_search
   returned a live result matching the property. If the search came
   back empty or ambiguous, both stay null and Step B falls back to
   rule 3.

## Consequences

- **Cost per study: ~$0.05–$0.15.** 5–15 searches at $0.01 each plus a
  small token spend on Sonnet.
- **Latency: ~20–40s.** Sequential before Step A in the Inngest
  pipeline.
- **Property Description becomes concrete** — Phase 5's narrative
  rewrite will read from `Property.enrichmentJson` to produce the
  "2,197 sq ft, built 1920" prose. Not in this PR.
- **Land allocation gets real** on properties where the county
  publishes assessor values. Benchmark-class properties end up at
  the assessor-derived ratio instead of the 30% market midpoint.
- **Zero schema change to Study**. All new data lives on Property.

## Rollback

Unset `V2_REPORT_PROPERTY_ENRICH`. Step B ignores any stale
`enrichmentJson` (the step's input no longer includes it when the
flag is off). The column stays behind; leaving stale data in place is
cost-free.

## Out of scope

- Licensing a real data API (ATTOM, Regrid). ~$0.30–$1/lookup,
  higher than our budget for the current tier. Revisit only if
  web_search quality proves insufficient.
- Caching enrichment across studies of the same property.
- Cross-validating sqft between assessor and listing when both
  return values (they often disagree by 5–15%). For now we surface
  whichever the model picks; a future PR can emit a discrepancy
  note.
