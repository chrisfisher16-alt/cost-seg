# ADR 0007 — CI split: fast checks always, e2e gated on secrets

Status: accepted, 2026-04-20

## Context

Shipping a working GitHub Actions CI to run on every push/PR to `main`.
The project has four validation layers we'd ideally run on every commit:

1. `pnpm typecheck` — pure, no secrets needed
2. `pnpm lint` + `pnpm format:check` — pure
3. `pnpm test` (vitest) — unit-only, no network
4. `pnpm build` (`next build`) — compiles routes; `lib/env.ts` is lazy so
   placeholder env satisfies the zod schema at build time
5. `pnpm test:e2e` (Playwright) — drives a _running_ app that hits real
   Postgres (estimator persists a `Lead`), real Supabase (auth redirects
   on intake), and Stripe (checkout preflight)

Layer 5 failed on the first auto-run against placeholder env with 20+
hydration errors and `PrismaClientKnownRequestError` on the Lead insert.
Placeholder env gets past `next build` but not a running app.

Options considered:

- **A. Spin up a Postgres service + mock Supabase in the workflow.**
  Real-ish. High complexity, breaks when Supabase SDK changes, and
  we'd be testing against a mock instead of the actual service.
- **B. Wire real test-project secrets into GitHub Actions secrets.**
  Honest — we'd actually be testing the full stack. Requires user
  action to create a dedicated test Supabase project (not prod).
- **C. Make e2e manual-trigger only until secrets exist; keep layers 1–4
  on every push.** Honest about what we can and can't validate today;
  doesn't block shipping fast feedback on the parts we _can_ validate.

## Decision

Ship option C today, with option B documented as the upgrade path.

- `.github/workflows/ci.yml` runs on every push/PR: install → `prisma
generate` → typecheck → lint → format:check → `vitest run` → `next
build`. Total ~1.5 min. Placeholder env vars inline in the workflow.
- `.github/workflows/e2e.yml` is `workflow_dispatch` only. The workflow
  is fully wired (Playwright install, browser cache, report upload on
  failure) — only the trigger is gated.
- `docs/runbooks/ci-test-environment.md` is the five-step runbook the
  operator follows to flip e2e back to push/PR: create a dedicated test
  Supabase project, add 9 `CI_*`-prefixed Actions secrets, swap the
  relevant `env:` values from literals to `${{ secrets.* }}` refs.
- Forward-compat: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` on both
  workflows, ahead of the Sept 2026 Node 20 → Node 24 cutover.
- `packageManager: pnpm@x.y.z` in `package.json` is the single source
  of truth for pnpm version — removed `version:` from `pnpm/action-setup@v4`
  to avoid `ERR_PNPM_BAD_PM_VERSION`.

## Consequences

- Every PR gets fast feedback on typecheck/lint/format/test/build within
  ~1.5 min.
- Runtime regressions (hydration mismatches, broken Supabase calls,
  bad Stripe integration) escape CI until the operator runs
  `pnpm test:e2e` locally or manually dispatches the E2E workflow.
- The runbook captures exactly what needs to happen to close that gap —
  the "why" is preserved here in case the question comes up again.

## Upgrade trigger

- First bug that would have been caught by push-triggered e2e and was
  instead caught in prod, or
- First external contributor asking how to run the test suite, or
- Whenever the operator has 30 min to execute `ci-test-environment.md`.

At that point: flip `on: workflow_dispatch` → `on: push + pull_request +
workflow_dispatch`, swap placeholder env vars to `${{ secrets.CI_* }}`,
push. CI + E2E then run in parallel on every PR (~6–8 min total feedback).
