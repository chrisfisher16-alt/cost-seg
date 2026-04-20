# V1.2 QA register

Living log of every defect surfaced during the V1.2 QA sweep (see
`docs/prompts/v1.2-qa-master-prompt.md`). One row per finding; update status
in place as fixes land. Grouped by bucket; newest at the top within each
bucket.

**Severity scale**

- **P0** — blocks ship. User-facing break, data loss, auth break, legal
  misstatement that could expose the business.
- **P1** — visible defect or risk that degrades trust / correctness but isn't
  a ship-blocker.
- **P2** — latent bug, silent failure mode, or a guardrail that would prevent
  a future P0/P1.
- **P3** — polish, style, or minor drift.

**Status vocabulary**

- **fixed** — commit + regression test landed.
- **open — deferred** — agreed with operator to address in a separate PR;
  does not block Bucket 1's merge.
- **open** — under investigation.
- **wontfix** — intentional; note why.

---

## Bucket 1 — Foundation

| ID  | Severity | Surface                                                   | Finding                                                                                                                                                                                                        | Status                 | Commit                           | Regression test                                                                        |
| --- | -------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| F1  | P3       | `eslint.config.mjs`                                       | `globalIgnores` did not include `.claude/**`, so ESLint walked every `.next/` build output inside Claude Code worktrees (11 480 errors on clean `main`).                                                       | fixed                  | [b78689c](../../commits/b78689c) | `pnpm lint` exits 0 on clean checkout.                                                 |
| F2  | P3       | `docs/prompts/v1.1-polish-master-prompt.md` (untracked)   | Operator-local leftover from prior session tripped `pnpm format:check`. Formatted in place with `prettier --write`; no git change since the file is not tracked. Fresh clones never hit this.                  | fixed (operator-local) | —                                | —                                                                                      |
| F3  | P1       | `lib/env.ts` + callers                                    | Zod validator `env()` exists, but ~27 files in `app/`, `lib/`, `components/`, and `inngest/` read `process.env.*` directly instead of calling `env()` / `clientEnv()`. Schema drift is silent at request time. | open — deferred        | —                                | —                                                                                      |
| F4  | P1       | privacy, methodology, README, runbooks, env, package.json | Six surfaces (privacy page, methodology page, README, deploy runbook, `lib/env.ts`, `package.json`, CI yml placeholders) still claimed AWS Textract is in the stack. ADR 0006 says Claude vision replaces it.  | fixed                  | [43d5beb](../../commits/43d5beb) | `tests/unit/deps.test.ts`, `tests/e2e/infra.spec.ts` (privacy + methodology absence).  |
| F5  | P2       | `lib/env.ts` × `lib/stripe/catalog.ts`                    | `STRIPE_PRICE_ID_DIY` is read by `lib/stripe/catalog.ts:20` but was missing from the zod schema. Unset value surfaced as DIY-checkout 500 instead of a boot-time env error.                                    | fixed                  | [4c28b86](../../commits/4c28b86) | `tests/unit/env.test.ts` (present / missing / wrong-prefix cases).                     |
| F6  | P2       | `lib/env.ts` × `instrumentation-client.ts`                | `NEXT_PUBLIC_SENTRY_DSN` read by `instrumentation-client.ts:3` but missing from server and client schemas.                                                                                                     | fixed                  | [4c28b86](../../commits/4c28b86) | `tests/unit/env.test.ts` (optional-URL cases in both `env()` and `clientEnv()`).       |
| F7  | P3       | `lib/studies/bypass-checkout.ts`, `.env.example`          | `FISHER_PROMO_CODE` referenced but not in `.env.example` or schema. Compare at line 135 used `===` on trim/lowercase strings — leaks secret prefix under timing analysis.                                      | fixed                  | [a5bb17d](../../commits/a5bb17d) | `tests/unit/bypass-checkout.test.ts` (10 cases including length-mismatch + case-trim). |
| F8  | P3       | `app/api/dashboard/portfolio.csv/route.ts`                | CSV download `Content-Disposition` filename hardcoded `cost-seg-portfolio-…csv`. Should follow `BRAND.name` for future-rebrand safety.                                                                         | fixed                  | [70db35c](../../commits/70db35c) | `tests/unit/portfolio-aggregate.test.ts` — `portfolioCsvFilename` cases.               |

### Predictions from §9 first reply that did not land

| Prediction                                                        | Reality                                                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expected 3–8 `console.log` stragglers                             | 0 found — codebase uses `console.info/warn/error` throughout.                                                                                                 |
| Expected missing auth guards on writes                            | 0 — every action/route gates via `requireAuth` / `requireRole` / `assertOwnership` / `requireStudyAccess`.                                                    |
| Expected rate-limit coverage gaps                                 | 0 — the 6 limiters in `lib/ratelimit/index.ts` cover the 6 required surfaces (estimator, lead capture, magic link, checkout start, share invite, sample PDF). |
| Expected bypassed `formatRelativeAge` or `formatAgeTerse` callers | 0 — both helpers are the only age formatters in use across their respective surfaces.                                                                         |

---

## Bucket 2 — Public marketing + auth + legal

_(not started)_

## Bucket 3 — Purchase + Stripe webhook

_(not started)_

## Bucket 4 — Customer app + DIY + CPA share

_(not started)_

## Bucket 5 — Pipeline + delivery + state machine

_(not started)_

## Bucket 6 — Admin + bulk actions

_(not started)_

## Bucket 7 — Output + cross-cutting

_(not started)_

## Bucket 8 — Vercel preview deploy + beta smoke

_(not started)_
