# ADR 0014 — v2 classifier fan-out to fit the HTTP timeout envelope

Status: accepted, 2026-04-23

**Shipped (Phase 8a):** fan-out is wired into `process-study` behind
`V2_REPORT_CLASSIFIER_FANOUT`. Per-slice `step.run` ids give each photo

- attempt its own durable memoization. Dedupe-stats telemetry event
  fires after merge.

**Deferred (Phase 8b):** `reclassifyV2ForDeliver` (the review-retry
loop's reclass path in `deliver-ai-report`) still calls the monolith.
Threading `step` through the review-retry loop + its DI seams is a
bigger refactor than the hot-path fix warranted; since review-retry
fires rarely and the failure mode there is "delivery gate fails, ops
re-triggers," accepting the monolith timeout risk on that path is
pragmatic. Track as 8b and address if we see review-retry timeouts in
prod.

## Context

Real studies with 10-12 photos are tripping Inngest's
`http_unreachable: server reset the connection` at ~370s inside Step C
(see the 2026-04-23 failure on study `a8829398`). The failing unit is a
single `classify-assets-v2` call that, on Opus 4.7 + `web_search` with
`max_uses: 50` and `maxTokens: 48_000`, runs 5-12 minutes of streamed
output for 80-180 line items. Vercel's Fluid Compute is on and the route
declares `maxDuration = 800`, but the SDK's long-lived streaming pattern
hits a proxy-layer idle/timeout before we reach the 800s ceiling.

Short-term mitigations shipped/queued:

- Hard cap photo uploads at 30 (ADR not needed; straight meta change).
- Flip `V2_REPORT_WEB_SEARCH=0` in prod (ops change).

These buy headroom but don't change the fundamental shape: one HTTP
round-trip owns an O(objects) Opus generation. Double the photos, halve
the margin. We need a shape where no single HTTP response owns the
entire classifier.

ADR 0009 set three invariants the v2 schedule must satisfy:

1. **Global dedupe** — "the same dining table shot from two angles is
   ONE line item."
2. **Exactly one residual** line with `isResidual=true`, category =
   property-type real-property class.
3. **Arithmetic balance** — Σ(adjustedCostCents) = buildingValueCents
   within ±5¢ per line and exact at the residual.

Any fan-out that violates these has to be rejected — they're the
contract the PDF + review gate rely on.

## Decision

Split `classify-assets-v2` into **three durably-memoized Inngest steps**.
Each sub-step is an independent `step.run()`, so Inngest retries each in
isolation and a network blip in one photo's call doesn't discard the
rest. The orchestrator stays a pure function; only its internal call
graph changes.

### Stage 1 — per-source candidate extraction (fan-out, parallel)

One `step.run()` per input source. Input sources are:

- **Each photo with a non-empty `detectedObjects` array** — one sub-step
  per photo. The call sees only that photo's detected-object list plus
  property metadata + asset library + building-value-cents for context
  (the model still needs building value to sanity-check multiplier
  ranges). **No `web_search`** — that was the latency lever; unit costs
  come from the model's 2025 retail knowledge per ADR 0009's
  `pricesearch` policy. Output: array of candidate line items for this
  photo, each with the full v2 schema (category, multipliers,
  justifications, `photoDocumentId` set to this photo's UUID,
  `isResidual: false`).

- **Receipts + CD capitalized costs** — one sub-step that classifies
  every `source="receipt"` line. Receipts are small (N ≤ 40 typical),
  multipliers are all 1.0, and the output is mechanical per ADR 0009
  — fits in a single short call.

Step IDs are `step-c-candidates-photo-{documentId}` and
`step-c-candidates-receipts`. Inngest's `step.run(id, fn)` memoizes by
id, so retries replay finished stages from the audit-log cache and
re-execute only the failed stage. Each call's wall-clock budget is
30-90s — well under any timeout envelope, with or without Fluid.

Concurrency: honor the existing `AI_DOC_CONCURRENCY` (default 3) via the
same `mapWithConcurrency` helper Phase 1 uses for `describe-photos`. We
do **not** use Inngest step parallelism here; a 30-photo study at
concurrency 3 finishes in ~10 batches ≈ 3-5 min wall-clock, which is
fine. Parallel Inngest steps add complexity (step.parallel, fan-in
barrier) without meaningful wall-clock improvement at this batch shape.

### Stage 2 — deterministic merge + dedupe

One `step.run("step-c-merge", ...)` that takes the union of candidates
and produces the final non-residual line-item set. **No LLM call.**
Dedupe rule:

- Two candidates collide when `normalize(name) === normalize(other.name)
&& category === other.category`. `normalize` is lowercase + strip
  punctuation + collapse whitespace + drop filler words ("the", "a",
  "with"). Collisions merge: keep the candidate with the higher-
  condition `physicalMultiplier` (proxy for the clearer photo), union
  the `photoDocumentId` set into a new `photoDocumentIds: string[]`
  field (schema addition — see Consequences).
- Receipt-sourced candidates never dedupe against photo-sourced ones
  even when names collide; a receipt is ground-truth cost and must stay
  as its own line.

This is the weakest link architecturally — if normalize is too loose we
over-merge distinct items; too strict and we regress on the v1 "same
table twice" case. We seed it with the dozen collision examples pulled
from the current production studies' audit logs and add a test fixture
per shape. A future PR can replace the deterministic merge with a small
LLM call (≤ 500 tokens output, fast) if the heuristic doesn't hold up.

### Stage 3 — residual plug + balance validation

One `step.run("step-c-finalize", ...)`. Deterministic, no LLM:

1. Compute residual = `buildingValueCents - Σ(adjustedCostCents)` over
   the merged non-residual set.
2. If residual < 0 (model over-allocated), fail the step with a balance
   error that threads back into a single retry of Stage 1 — the whole
   fan-out replays with the error message embedded per photo's prompt.
   This mirrors v1's existing balance-retry shape; the retry is
   orchestrator-level, not Inngest-level.
3. Build the residual line item with category = property-type real-
   property class, attach to the line-item set, stamp `schema: "v2"`,
   return.

Per-line arithmetic check (`quantity × unitCost × multipliers ==
adjustedCost ± 5¢`) still runs here over the merged set.

### Feature flag

`V2_REPORT_CLASSIFIER_FANOUT`. Read once in `process-study.ts` at the
same point the current `isV2ClassifierEnabled()` gate sits; when ON,
the orchestrator dispatches into the fan-out; when OFF, falls through
to the existing single-call `classifyAssetsV2`. Both paths produce the
same `schema: "v2"` output shape (modulo the new `photoDocumentIds`
array; see Consequences), so downstream PDF + review gate need no
changes.

Rollout ladder:

1. Ship behind flag = 0. The monolith stays the prod path.
2. Enable on preview. Sample 10 real studies. Compare line-item counts
   - residual sizes + cost/latency against the monolith baseline.
3. Flip on prod. Watch Inngest timeouts + customer retries for 72h.
4. Once stable for 2 weeks: delete the monolith path, drop the flag.

### Review-retry loop interaction (ADR 0013)

`reclassifyV2ForDeliver` currently threads `priorAttemptError` through
`ClassifyAssetsV2OrchestratorInput.priorAttemptError` into the single
call's user prompt. In the fan-out, the retry error is prepended to
**every** Stage 1 candidate call's user prompt — the review gate's
feedback is almost always about specificity / category assignment, both
of which apply per-photo. The merge and finalize stages are
deterministic and don't need the hint.

Cache key: Stage 1 sub-steps key on `(operation,
hash(photoAnalysis + priorAttemptError + webSearchEnabled))` per ADR
0013's cache semantics. A different `priorAttemptError` → cache miss,
correct behavior.

## Consequences

- **Schema addition**: the line-item schema grows
  `photoDocumentIds: string[]` (optional, omitted for receipt-sourced
  items; populated with 1+ UUIDs for photo-sourced items after merge).
  The existing `photoDocumentId: string | null` stays for backward
  compatibility but is deprecated — new code reads the array. PDF
  renderer update: show all thumbnails for a merged item in Appendix B
  instead of one.
- **Wall-clock latency improves.** 12 photos at concurrency 3 ≈ 3-5 min
  vs. 6-12 min monolith. 30 photos at concurrency 3 ≈ 7-10 min — still
  fits Inngest's 2-hour step cap with headroom.
- **Cost roughly flat.** More calls, smaller each; total input tokens
  rise slightly because the asset library is sent N times (once per
  photo call), but that's ~4k tokens × N extra input, offset by the
  smaller per-call output. Net increase: ~10-15% per study.
- **Dedupe heuristic is the main new failure mode.** Regression guard:
  property-type-stratified fixtures of collision shapes in
  `tests/unit/classify-merge.test.ts`, plus a telemetry event
  `classifier.dedupe_stats` that records pre/post merge counts so we
  can spot drift without a test failure.
- **Inngest step count per study rises** from 1 to 2 + N (photos) + 1
  (receipts) + 1 (finalize). Inngest bills per step-run but each run
  is shorter; expect a small cost increase there, within noise on the
  Inngest plan.
- **Review retry cache miss rate rises** because `priorAttemptError`
  now invalidates N separate cache entries. Acceptable — the retry
  path is the rare case.

## Rollback

Unset `V2_REPORT_CLASSIFIER_FANOUT`. The monolith path is untouched by
this PR; flipping off restores exact prior behavior. Schedules produced
while the flag was on retain `photoDocumentIds` arrays in their stored
JSON but the PDF renderer falls back to `photoDocumentId` (the singular
field stays populated with the first UUID) so rendering stays correct.

## Out of scope

- **LLM-based merge in Stage 2.** Worth revisiting if the deterministic
  heuristic's false-merge rate exceeds 2% in preview telemetry; ship as
  a follow-up.
- **Anthropic Message Batches API.** A separate cost-latency lever for
  cold-path reruns (admin re-deliver). Different shape, different
  ADR — track as Phase 8.
- **Pricing-catalog ingest.** ADR 0009's `pricesearch` policy still
  applies; dropping `web_search` means we rely harder on the model's
  internal 2025 retail knowledge. A future PR with a validated
  retailer-URL catalog would re-enable defensible `sourceUrl` values;
  that's Phase 3 per ADR 0009 and unchanged by this ADR.
- **Non-v2 pipelines.** v1 classifier stays as-is; this ADR is scoped
  to the v2 path only.
