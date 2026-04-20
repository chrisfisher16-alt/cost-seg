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

| ID   | Severity | Surface                                                | Finding                                                                                                                                                                                                                                                                                                                                                    | Status                   | Commit                                                                  | Regression test                                                                                  |
| ---- | -------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| B2-1 | P1       | `/legal/scope-disclosure`                              | `Last updated ${new Date().toLocaleDateString()}` rerendered on every request and drifted with browser locale (`4/20/2026` vs `20/04/2026`). A legal page's last-updated is load-bearing trust signal; fabricating today's date on every visit is the opposite signal.                                                                                     | fixed                    | [946d9db](https://github.com/chrisfisher16-alt/cost-seg/commit/946d9db) | `tests/e2e/infra.spec.ts` — two-reload equality + negative `M/D/YYYY`-shape assert.              |
| B2-2 | P1       | `lib/pdf/disclosure.ts` vs marketing + email templates | Three divergent scope-disclosure paraphrases: `TIER_1_SCOPE_DISCLOSURE` const (PDF), `components/marketing/ScopeDisclosure.tsx` (non-compact + compact), `lib/email/templates/WelcomeEmail.tsx`. §5.6 says verbatim everywhere — any drift is P0. This is legal text; I won't unilaterally harmonize.                                                      | open — flag for operator | —                                                                       | —                                                                                                |
| B2-3 | P2       | `app/api/samples/[id]/pdf/route.ts`                    | Sample PDF download `Content-Disposition` filename hardcoded `cost-seg-sample-<id>.pdf`. Same class as Bucket 1 F8; leaks the old brand into every sample a visitor saves.                                                                                                                                                                                 | fixed                    | [babf5f0](https://github.com/chrisfisher16-alt/cost-seg/commit/babf5f0) | `tests/unit/samples.test.ts` + extended `tests/e2e/infra.spec.ts` Content-Disposition assertion. |
| B2-4 | P3       | `lib/stripe/client.ts`                                 | Stripe SDK constructed with `appInfo: { name: "cost-seg", version: "0.1.0" }` — visible in Stripe's dashboard event log and billing reports.                                                                                                                                                                                                               | fixed                    | [5b752f0](https://github.com/chrisfisher16-alt/cost-seg/commit/5b752f0) | `tests/unit/stripe-client.test.ts` — mocks Stripe ctor, asserts `appInfo.name === BRAND.name`.   |
| B2-5 | P2       | 14 files across app / components / lib                 | `support@segra.tax` hardcoded in 14 locations outside `lib/brand.ts` (marketing: contact/terms/privacy/compare/FaqSection; error shells: not-found/global-error/ErrorFallback; in-app: dashboard/intake × 3/study-view/share/success/PipelineLive × 3; auth: magic-link-error). Three topical inboxes (`legal`, `privacy`, `compare`) hardcoded similarly. | fixed                    | [2201246](https://github.com/chrisfisher16-alt/cost-seg/commit/2201246) | `tests/unit/brand-emails.test.ts` — `git grep` SSOT guard fails CI on any new hardcoded email.   |
| B2-6 | P3       | 14 public routes × 3 viewports                         | Master prompt §4 Bucket 2 asked for keyboard walk + 360/768/1280 viewport sweep. No findings surfaced — every route rendered cleanly on all three widths — but the sweep itself deserved a permanent home so regressions land in CI rather than a manual audit.                                                                                            | fixed                    | [f5e92bd](https://github.com/chrisfisher16-alt/cost-seg/commit/f5e92bd) | `tests/e2e/viewport-probe.spec.ts` — 42 overflow assertions, runs on every e2e invocation.       |

### Audits that surfaced no findings (Bucket 2)

| Audit                             | Result                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Footer link resolution            | 12 links across Product / Company / Trust & compliance sections all resolve to real routes. `mailto:` uses `BRAND.email.support`. `#main-content` target exists on every public route.                                                                  |
| Sign-in form + cooldown           | `SignInForm` properly wires `classifyMagicLinkError` → `retryAfterSec` → live countdown; button stays disabled through the cooldown; message updates per-tick (not stale).                                                                              |
| `/auth/callback` open-redirect    | Relative-path + `!startsWith("//")` guard at [auth/callback/route.ts:29](app/auth/callback/route.ts:29) handles decoded-slash injection; Supabase-unconfigured / missing-code / session-exchange-fail all redirect to `/sign-in?error=callback`.        |
| Google OAuth unconfigured         | Button always renders; if Google isn't enabled in Supabase, `signInWithOAuth` errors and we surface "Could not start the Google sign-in flow." Acceptable degradation — no way to detect the provider list from the client without a server round-trip. |
| `console.log` on public routes    | Zero (codebase-wide — carried over from Bucket 1).                                                                                                                                                                                                      |
| Auth gating on marketing surfaces | All marketing routes are public by design; `tests/e2e/auth.spec.ts` confirms `/dashboard` and `/admin` redirect unauthenticated requests to `/sign-in`.                                                                                                 |
| Full e2e suite                    | **69/69 passing** against the live dev server; adding Bucket 2 specs brings it to **72/72** (`+1` last-updated, `+42` viewport minus the shared 69 baseline).                                                                                           |

### Running totals after Bucket 2

- **Unit tests:** 225 → **253** (+28: B1 added 21, B2 added 7 across `samples.test.ts` + `stripe-client.test.ts` + `brand-emails.test.ts`).
- **E2E tests:** 69 (after B1) → **112** (+43: B2 added 1 last-updated-stability + 42 viewport-overflow assertions across 14 routes × 3 breakpoints).

## Bucket 3 — Purchase + Stripe webhook

| ID   | Severity | Surface                                 | Finding                                                                                                                                                                                                                                                                                                                                       | Status          | Commit                                                                  | Regression test                                                                 |
| ---- | -------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| B3-1 | P2       | `lib/stripe/client.ts`                  | `isStripeConfigured()` only required `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID_TIER_1` + `STRIPE_PRICE_ID_TIER_2`. After Bucket 1 F5 added DIY to the env schema, a deployment missing the DIY price id passed the check, rendered the DIY checkout form, and failed at `createCheckoutSession` with a vague "Could not start checkout" message. | fixed           | [de159b9](https://github.com/chrisfisher16-alt/cost-seg/commit/de159b9) | `tests/unit/stripe-client.test.ts` — five cases covering every tier price id.   |
| B3-2 | P3       | `lib/studies/create-from-checkout.ts`   | `resolveOrCreateUser` falls back to `listUsers({ perPage: 200 })` without pagination on the "email already exists" race. For projects with >200 users AND a concurrent-webhook race AND the racing user not in the first 200, the handler throws "Could not create or find user." Ship-ready for V1 (solo operator, low user count).          | open — deferred | —                                                                       | —                                                                               |
| B3-3 | P3       | `components/marketing/AddressInput.tsx` | useEffect dep array `[onChange, onPlace]` caused a fresh `new google.maps.places.Autocomplete(...)` every parent rerender — `GetStartedForm` passes inline callbacks so identities change on every keystroke. Leaks pac-container divs; stale listeners can double-fire.                                                                      | fixed           | [cae171a](https://github.com/chrisfisher16-alt/cost-seg/commit/cae171a) | `tests/unit/address-input.test.tsx` — ref-pattern assertions across re-renders. |

### Audits that surfaced no findings (Bucket 3)

| Audit                                 | Result                                                                                                                                                                                                               |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tier param handling                   | `isTier()` type-guard at `/get-started/page.tsx:22` accepts only `DIY`/`AI_REPORT`/`ENGINEER_REVIEWED`; invalid + missing → silent default to `AI_REPORT`. Reasonable.                                               |
| `startCheckoutAction` rate limit      | `startCheckoutLimiter().check(hashIp(ip))` at [actions.ts:43](app/get-started/actions.ts:43) runs BEFORE zod validation, preventing bots from burning the limiter with malformed payloads. 8 per 5min per hashed IP. |
| Promo bypass wiring                   | `promoBypassEnabled()` + `promoCodeMatches()` (Bucket 1 F7) + `bypassCheckoutAndCreateStudy()` → `signInViaAdminMagicLink` → relative redirect to `/studies/{id}/intake`.                                            |
| Stripe webhook signature verification | 503 when secret unset, 400 when signature missing/invalid — verified by existing `tests/e2e/infra.spec.ts` "Stripe webhook endpoint" block.                                                                          |
| Webhook idempotency                   | `prisma.study.findUnique({ where: { stripeSessionId } })` at [create-from-checkout.ts:26](lib/studies/create-from-checkout.ts:26) → early return if exists. Backed by `@unique` constraint.                          |
| DIY tier synchronous path             | Webhook creates Study with `status: AWAITING_DOCUMENTS` for all tiers (same path); DIY moves to DELIVERED from the `/studies/[id]/diy` form action, not Inngest. Matches §2.3.                                       |
| `/get-started/success` states         | Fresh (Study row resolves, tier-specific next steps) / already-fulfilled (idempotent same screen) / webhook-failed or no session_id (tier-null fallback copy). Handled.                                              |
| CheckoutMetadata encode/decode        | Address field clamping (480/240/120/16 chars) + tier + propertyType positive-list validation already tested in `tests/unit/checkout-metadata.test.ts`.                                                               |
| `/auth/callback` open-redirect        | Confirmed in Bucket 2 — `safeNext` refuses absolute + protocol-relative paths.                                                                                                                                       |

### Running totals after Bucket 3

- **Unit tests:** 253 → **260** (+7: `stripe-client.test.ts` grew 2 → 7, `address-input.test.tsx` +2).
- **E2E tests:** 112 → **112** (no new e2e this bucket — fixes land in unit; existing webhook-signature + idempotency-adjacent tests already in `infra.spec.ts`).

## Bucket 4 — Customer app + DIY + CPA share

| ID   | Severity | Surface                               | Finding                                                                                                                                                                                                                                                                                                             | Status          | Commit                                                                  | Regression test                                                       |
| ---- | -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| B4-1 | P1       | `lib/studies/share.ts`                | `acceptShareByToken` computed the email-match inside an empty `if` block — the comment described a "record note for audit" but no code executed. A CPA signed in with email B could accept an invite addressed to email A and the admin inspector had no signal. Day 49's "warn on email mismatch" was never wired. | fixed           | [88eb757](https://github.com/chrisfisher16-alt/cost-seg/commit/88eb757) | `tests/unit/share.test.ts` — `isAcceptedEmailMatch` helper (5 cases). |
| B4-2 | P2       | `components/app/ShareStudyDialog.tsx` | Cooldown button rendered `Math.ceil(cooldownSec / 60) + "m"` unconditionally. A 30-second throttle label read "Try again in 1m" but the button re-enabled at 30s — the label lied. Per-study share limit caps at 5/hour so `cooldownSec` spans 1–3600s; old formula only worked at one end.                         | fixed           | [4b2a23e](https://github.com/chrisfisher16-alt/cost-seg/commit/4b2a23e) | `tests/unit/share.test.ts` — `formatShareCooldown` helper (4 cases).  |
| B4-3 | P3       | `components/intake/DiyForm.tsx`       | DIY land-value suggestion renders a hardcoded percentage of purchase price via `DEFAULT_LAND_PCT[propertyType]` with no hint explaining the number. Pure UX polish — user sees "$60,000 land value" prefilled without knowing where it came from.                                                                   | open — deferred | —                                                                       | —                                                                     |

### Audits that surfaced no findings (Bucket 4)

| Audit                                                       | Result                                                                                                                                   |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard role-aware empty states (Day 37)                  | `isCpa` branch at [dashboard/page.tsx:205-208](<app/(app)/dashboard/page.tsx:205>) drives tier cards vs shared-with-you copy.            |
| Intake stuck-warning (Day 57)                               | `nextAction.tone === "warning"` branch at intake/page.tsx:106.                                                                           |
| UploadZone keyboard affordance (Day 65)                     | Tab → Space/Enter → file picker wired at UploadZone.tsx:178-184; visible focus ring present.                                             |
| ZIP + acquired-date hints in PropertyForm (Day 29 + Day 40) | `zipHint` + `acquiredDateHint` both rendered; inline invalid-ZIP feedback.                                                               |
| Auth guards on intake / DIY / processing / view             | `assertOwnership` / `resolveStudyAccess` on every page; no bypass paths.                                                                 |
| `classifyShareError` kinds (Day 49)                         | 5 kinds — not-found, revoked, wrong-account, invalid-email, generic — each with tailored title / hint / recovery.                        |
| `classifyFailure` kinds (Day 30)                            | missing-document, unbalanced-schedule, admin-flagged, generic — all surface in `FailedPanel` with support mailto subject pre-fill.       |
| `estimatePipelineEta` wiring (Day 25)                       | PipelineLive.tsx:297 computes per-step ETA from pipeline-eta.ts, renders inline.                                                         |
| `prefers-reduced-motion` respected (Day 13)                 | `motion-safe:animate-*` used throughout PipelineLive (lines 371, 565, 576, 587); `<CelebrationTrigger>` respects media query internally. |
| Confetti on delivery                                        | `<CelebrationTrigger active={state.isDelivered} />` at PipelineLive.tsx:94.                                                              |
| Queued state (Day 34)                                       | `QueuedPanel` branch at PipelineLive.tsx:100-106.                                                                                        |
| Share invite rate limit (Day 67) + Day 39 cooldown pattern  | `shareInviteLimiter()` gates the action; cooldown ticks locally; button disabled during.                                                 |
| CPA invite email content (Day 53 snapshot)                  | Already covered by `tests/unit/emails.test.ts`.                                                                                          |
| Radix Dialog a11y (Escape + focus return + trap)            | ShareStudyDialog uses Radix primitives — behavior inherited.                                                                             |

### Running totals after Bucket 4

- **Unit tests:** 260 → **271** (+11: `share.test.ts` grew 3 → 14 with the two new helpers + regression cases).
- **E2E tests:** 112 → **112** (no new e2e this bucket — all fixes are unit-testable).

## Bucket 5 — Pipeline + delivery + state machine

| ID   | Severity | Surface                        | Finding                                                                                                                                                                                                                                                                                            | Status | Commit                                                                                                                                            | Regression test                                                                                                                                                                                  |
| ---- | -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B5-1 | P1       | `Study.status` write sites (9) | Every in-flight Study.status write was direct-to-Prisma — 9 call sites each re-derived the legal-transition rules locally or not at all. A rerun from FAILED, an admin mark-failed on DELIVERED, a DIY-only edge being taken by Tier 1/2: no structural guard. §4 Bucket 5 required a single SSOT. | fixed  | [c64dcbe](https://github.com/chrisfisher16-alt/cost-seg/commit/c64dcbe) · [a952a21](https://github.com/chrisfisher16-alt/cost-seg/commit/a952a21) | `tests/unit/transitions.test.ts` — 20 cases covering every legal edge, every tier-gate, FAILED/REFUNDED/recovery semantics, terminal-state bounds, no-op rejection, runtime refused-error guard. |

### Audits that surfaced no findings (Bucket 5)

| Audit                                                      | Result                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `process-study.ts` AiAuditLog idempotency (§4)             | `step.run` wraps every AI call; the AiAuditLog cache in `lib/ai/call.ts` keys on `(operation, inputHash)` so retries return prior output. No changes needed.                                                                             |
| `process-study.ts` PII scrub                               | Confirmed in earlier sweeps — `lib/ai/scrub.ts` strips names/emails before prompt submission; unit-tested in `tests/unit/ai-scrub.test.ts`.                                                                                              |
| `process-study.ts` retry / FAILED-on-exhausted             | Function declared `retries: 2`; `NonRetriableError` thrown for domain failures (no CD, unbalanced schedule); `markStudyFailed` called before throwing so the row reaches FAILED even without another retry.                              |
| `deliver.ts` Tier 1 vs Tier 2 handler boundaries           | `deliverAiReport` accepts DIY + AI_REPORT only (line 129-131); `deliverEngineeredStudy` rejects non-Tier-2 (line 264-266). Both guard already-DELIVERED.                                                                                 |
| `deliver.ts` 7-day signed URL                              | `DELIVERABLE_EXPIRY_SECONDS = 7 * 24 * 60 * 60` (line 51), used for both Tier 1 and Tier 2 and the resend path.                                                                                                                          |
| `resendDeliveryEmail` no status change (Day 68)            | `if (study.status !== "DELIVERED") return { ok: false }` — never writes a status; regenerates signed URL and re-sends the email only.                                                                                                    |
| `safeInngestSend` (Day 28)                                 | Header comment explicitly documents the "use from user-action entry points; don't use inside Inngest functions" split. DIY action + admin-rerun use `safeInngestSend`; the pipeline itself lets errors throw for durable retry. Correct. |
| Initial-state row creation at `create-from-checkout.ts:83` | Intentionally NOT routed through `transitionStudy` — it's a `prisma.study.create(…, status: "AWAITING_DOCUMENTS")` on a brand-new row, not a transition from any prior state.                                                            |

### Running totals after Bucket 5

- **Unit tests:** 271 → **291** (+20 — new `tests/unit/transitions.test.ts`).
- **E2E tests:** 112 → **112**.

## Bucket 6 — Admin + bulk actions

_(not started)_

## Bucket 7 — Output + cross-cutting

_(not started)_

## Bucket 8 — Vercel preview deploy + beta smoke

_(not started)_
