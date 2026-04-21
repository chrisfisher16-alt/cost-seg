-- v2 Phase 4: property enrichment from public records. Store the structured
-- output of the `enrich-property` step on Property directly. Nullable;
-- populated only when V2_REPORT_PROPERTY_ENRICH is on + the step has run.
--
-- Safe to apply: additive, no row rewrites.

ALTER TABLE "Property"
  ADD COLUMN "enrichmentJson" JSONB;
