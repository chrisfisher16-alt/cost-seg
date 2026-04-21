# ADR 0013 — v2 Phase 7: QA gate (layout discipline + vision-model review)

Status: accepted, 2026-04-20

## Context

Phase 5 produces a PDF that renders v2 data. But rendering 100+ photo
thumbnails and paragraph justifications inside `@react-pdf/renderer`
is a routine source of layout regressions: a card split across pages,
an image overlapping the caption below it, a section heading
stranded at the bottom of a page, placeholder text like "Not
specified" leaking into a delivered PDF.

The acceptance criteria now include (#9): the vision-model review
step runs and returns zero blockers; the layout unit test passes.

The master prompt's Phase 7 mandates two layers:

1. **Deterministic layout discipline** — wrap invariants in the
   template so react-pdf physically cannot split a block.
2. **Vision-model review** — rasterize the rendered PDF to page
   images, hand them to a Claude vision call with a structured
   rubric, and block delivery on layout / content blockers.

## Decision

Phase 7 ships in two slices. This ADR covers both but slice 1 is
what lands in this PR.

### Slice 1 (this PR) — contract + layout discipline

**7a — layout discipline in the template**:

- Add `minPresenceAhead` prop to every h2/h3 heading so a heading
  cannot orphan at the bottom of a page. react-pdf moves the
  heading to the next page when fewer than the specified units of
  space remain below it.
- Audit every atomic block (asset card, MACRS row group, KPI panel,
  reference card) for `wrap={false}`. The existing template has
  most in place — this slice confirms and patches gaps.
- Explicit `break` prop before each AppendixCover so every appendix
  starts on a fresh page (regardless of how the previous section
  wrapped).
- **New unit test `tests/unit/pdf-layout.test.ts`**. Uses
  `@react-pdf/renderer` to render the fixture to a PDF, then parses
  the PDF text content with `pdf-parse` (already in the stack or
  easy to add) and asserts:
  - Every page contains the disclosure text.
  - No page begins with an h2-shaped line followed immediately by
    the next page (proxy for "no orphaned headings").
  - Image/text overlap is approximated by counting Image xrefs per
    page against Text objects in the same page's content stream;
    full pixel-overlap detection deferred to the vision reviewer.

**7b — review contract**:

- `lib/ai/prompts/review-report.ts` — system prompt + tool schema +
  Zod output schema + versioned rubric. Ships in this slice so the
  review contract is locked before implementation.
- `lib/ai/steps/review-report.ts` — pure function that takes an
  already-rasterized array of page image buffers and batches them
  (~8 per call) to Claude with vision. Does NOT rasterize on its
  own (see slice 2). Callable from a future Inngest wiring.
- Feature flag `V2_REPORT_REVIEW`.

### Slice 2 (this PR) — rasterization + deliverAiReport wiring

- **`lib/pdf/rasterize.ts`** wraps `pdf-to-png-converter` behind a
  dynamic `import()`. The dep is **NOT** declared in `package.json`.
  Operators install it when they flip `V2_REPORT_REVIEW=1`:
  ```
  pnpm add pdf-to-png-converter
  ```
  Calling the helper without the dep throws a clear, actionable
  error. This lets the contract land without forcing a 20MB+ bundle
  increase on teams that haven't turned the feature on.
- **`lib/studies/review-gate.ts`** composes rasterize + review +
  enforce policy. Returns `{ kind: "ok" | "blocked", output, batchCount, warning? }`.
  Dep-missing / rasterizer-thrown errors degrade to
  `{ kind: "ok", warning }` — a review we can't run is not a blocker.
- **`deliverAiReport` wiring** (`lib/studies/deliver.ts`): after
  `renderAiReportPdf`, runs the gate. Persists findings to a
  `StudyEvent` of kind `pipeline.review_completed` or
  `pipeline.review_failed` regardless of enforce mode. If
  `V2_REPORT_REVIEW_ENFORCE=1` and the gate returns `blocked`, the
  function short-circuits: no upload, no email, returns
  `{ ok: false, reviewBlockerCount, skippedReason }` so ops can
  re-trigger after the upstream fix.
- **Flag:** `V2_REPORT_REVIEW_ENFORCE` (distinct from
  `V2_REPORT_REVIEW`). Run review for a week in telemetry-only mode,
  then flip enforce once the false-positive rate is known.

### Slice 3 — retry loop orchestration (landed in-process)

The pure-function contract in `lib/studies/review-feedback.ts`
(partitionFindings / formatFindingsAsClassifierHint /
formatFindingsAsLayoutHint / decideNextAction, retry cap 2)
is consumed by a new in-process orchestrator:

- **`lib/studies/review-retry-loop.ts::runRenderReviewLoop`** — pure
  function with three DI seams (renderPdf, runReview,
  reclassifyAndPersist). Loops up to `REVIEW_RETRY_CAP+1` iterations:
  clean → ship; content blocker → reclassify + loop; layout blocker
  or cap reached → return blocked.
- **`lib/studies/reclassify-for-deliver.ts::reclassifyV2ForDeliver`**
  — fetches the study's documents + improvements from DB, calls
  `classifyAssetsV2` with a top-level `priorAttemptError`, persists
  the new v2 schedule to `Study.assetSchedule`. The top-level
  `priorAttemptError` (distinct from the internal balance-retry
  error) was added to `ClassifyAssetsV2OrchestratorInput` in this
  slice.
- **`deliverAiReport` wiring** — when `V2_REPORT_REVIEW=1` AND the
  persisted schedule is v2, delivery runs through
  `runRenderReviewLoop` instead of the single-shot render+review.
  A `pipeline.review_completed` / `pipeline.review_failed`
  StudyEvent captures final findings + `attempts` + `reclassifications`.
  Non-v2 schedules keep the slice-2 single-pass path.

**Scope cut remaining:** layout blockers still block delivery (no
retry-render implementation). The template isn't runtime-parameterized
for layout fixes — a dev must patch code. This matches the master
prompt's intent (layout issues → template fix PR) while keeping the
automatic loop useful for the classifier path where findings CAN be
fed back.

**Cache semantics on reruns:** `classifyAssetsV2` internally keys
`AiAuditLog` rows by `(operation, inputHash)` where the hash
includes the prompt user-message. A different `priorAttemptError`
produces a different hash → cache miss → real call. Safe to invoke
within the cap without cache-key collisions.

**Operational rollout:** still the same ladder as slice 2.
`V2_REPORT_REVIEW=1` (telemetry-only) for a week, then
`V2_REPORT_REVIEW_ENFORCE=1` once false-positive rate is low. The
retry loop is active whenever review is on AND the schedule is v2 —
it's additive, not gated by a separate flag, because a retry that
doesn't fix anything is still cheaper than shipping a bad report.

## Consequences

**Slice 1 (this PR):**

- Template refactor is low-risk — `minPresenceAhead` and
  `wrap={false}` are additive; existing tests keep passing.
- Layout invariant test is cheap (< 1s) and runs in the existing
  vitest suite.
- Review prompt + schema + step skeleton let future PRs implement
  rasterization + wiring without touching the contract.
- Zero new runtime dependencies.

**Slice 2 (deferred):**

- Rasterization adds one native dep (likely `@napi-rs/canvas` or
  `pdf-to-png-converter`). Vercel deploy bundle size is the key
  risk to manage.
- Review-on-by-default pushes Step D + delivery latency by 30–90s
  per study (rasterize + 5–10 batched vision calls).
- Cost: ~$0.30–$1.00/study in Opus vision tokens. Acceptable vs.
  the cost of shipping a bad PDF.

## Rollback

Slice 1: unset `V2_REPORT_REVIEW`. The step is exported but no
caller invokes it; the layout invariants in the template are always
on (harmless — they preserve layout in v1 path too).

Slice 2 (when shipped): unset `V2_REPORT_REVIEW_ENFORCE` — review
still runs (telemetry-only) until that flag is flipped.

## Out of scope

- Pixel-exact image/text overlap detection in the unit test. The
  vision reviewer handles this; the unit test is a cheap guardrail
  for structural invariants (disclosure per page, no orphan headings).
- Fixture-image capture for visual regression testing. Defer to
  `tests/integration/*` once slice 2 lands.
- A/B-testing the review on real delivered studies before enforce
  mode. Operational decision when slice 2 lands.
