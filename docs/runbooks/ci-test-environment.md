# CI test environment — unlocking push-triggered e2e

> **Status:** pending user execution. Everything below requires the
> operator's Supabase + Stripe accounts. Claude can't create services
> on your behalf.

## Why this is needed

The fast CI workflow (`.github/workflows/ci.yml`) already runs on every
push + PR with placeholder env vars — typecheck, lint, format, unit tests,
and `next build` all work without real secrets.

The e2e workflow (`.github/workflows/e2e.yml`) does _not_ run on push
right now. It's `workflow_dispatch` only. Playwright drives a real
running app, and that app's routes talk to Postgres (lead capture on
the estimator), Supabase (auth redirects on intake), and Stripe
(checkout preflight). The first auto-run against placeholder env failed
with 20+ hydration errors and a `PrismaClientKnownRequestError`.

This runbook wires a dedicated test Supabase project + Stripe test-mode
keys into GitHub Actions secrets, then flips e2e back to push/PR so it
runs automatically alongside CI.

## What you'll create

One isolated test environment:

- **Supabase project** — separate from prod. Cheap plan is fine. Runs a
  dedicated Postgres + Supabase Auth for CI only.
- **Stripe test-mode keys** — test keys already exist; you just need to
  copy them into Actions secrets.
- **GitHub Actions secrets** — 9 total, named exactly as listed below.

Estimated time: 20–30 minutes if Supabase signup goes smoothly.

## Step 1: create the test Supabase project

1. <https://supabase.com/dashboard/new/cost-seg-ci> (or use the UI — org
   = your existing one; project name = `cost-seg-ci`; region = closest
   to github.com for lowest CI latency, typically `us-east-1`).
2. Wait for provisioning (~2 min).
3. From **Settings → API**, copy:
   - Project URL → will be `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → will be `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → will be `SUPABASE_SERVICE_ROLE_KEY`
4. From **Settings → Database → Connection string**:
   - **Transaction pooler** URI → will be `DATABASE_URL`
     (append `?pgbouncer=true&connection_limit=1` for Prisma)
   - **Direct connection** URI → will be `DIRECT_URL`
5. Apply migrations once so the schema exists:

   ```bash
   DIRECT_URL="<paste direct URL>" pnpm prisma migrate deploy
   ```

   The two legacy-baseline placeholders from `migration-baseline.md`
   don't apply here — this is a fresh DB, so it gets the full schema in
   one shot from the committed migrations.

## Step 2: Stripe test-mode keys

Already in your Stripe dashboard:

1. Toggle **Test mode** (top-right).
2. **Developers → API keys** — copy the `sk_test_...` secret key →
   `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks** — add an endpoint pointing at wherever e2e
   will hit (for CI, Stripe won't actually call back since tests drive
   Stripe via the CLI/mocks; you can reuse the prod webhook secret
   placeholder OR create a dedicated one via `stripe listen` offline).
4. **Products** — if you haven't already, create three test-mode
   products matching the prod IDs:
   - DIY @ $149 → `STRIPE_PRICE_ID_DIY`
   - AI Report @ $295 → `STRIPE_PRICE_ID_TIER_1`
   - Engineer-Reviewed @ $1,495 → `STRIPE_PRICE_ID_TIER_2`

## Step 3: wire the GitHub Actions secrets

<https://github.com/chrisfisher16-alt/cost-seg/settings/secrets/actions>

Add these **repository secrets** (not environment secrets — keep it
simple, no environments defined yet):

| Secret name                    | Value                                                 |
| ------------------------------ | ----------------------------------------------------- |
| `CI_DATABASE_URL`              | Supabase pooler URL (from Step 1.4)                   |
| `CI_DIRECT_URL`                | Supabase direct URL (from Step 1.4)                   |
| `CI_SUPABASE_URL`              | Project URL (from Step 1.3)                           |
| `CI_SUPABASE_ANON_KEY`         | anon public key                                       |
| `CI_SUPABASE_SERVICE_ROLE_KEY` | service role secret                                   |
| `CI_STRIPE_SECRET_KEY`         | `sk_test_...`                                         |
| `CI_STRIPE_WEBHOOK_SECRET`     | `whsec_...` (or reuse a local `stripe listen` secret) |
| `CI_STRIPE_PRICE_ID_TIER_1`    | `price_...` for AI Report                             |
| `CI_STRIPE_PRICE_ID_TIER_2`    | `price_...` for Engineer-Reviewed                     |

The `CI_` prefix keeps these visually distinct from any future prod
secrets you might add later.

## Step 4: flip e2e back to push/PR triggers

Edit `.github/workflows/e2e.yml`:

1. Replace:

   ```yaml
   on:
     workflow_dispatch:
   ```

   with:

   ```yaml
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]
     workflow_dispatch:
   ```

   (Keep `workflow_dispatch` too so the Actions → E2E → "Run workflow"
   button still works for re-runs.)

2. Swap these specific lines in the `env:` block from placeholders to
   `${{ secrets.* }}` refs:

   ```yaml
   NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.CI_SUPABASE_URL }}
   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.CI_SUPABASE_ANON_KEY }}
   SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.CI_SUPABASE_SERVICE_ROLE_KEY }}
   DATABASE_URL: ${{ secrets.CI_DATABASE_URL }}
   DIRECT_URL: ${{ secrets.CI_DIRECT_URL }}
   STRIPE_SECRET_KEY: ${{ secrets.CI_STRIPE_SECRET_KEY }}
   STRIPE_WEBHOOK_SECRET: ${{ secrets.CI_STRIPE_WEBHOOK_SECRET }}
   STRIPE_PRICE_ID_TIER_1: ${{ secrets.CI_STRIPE_PRICE_ID_TIER_1 }}
   STRIPE_PRICE_ID_TIER_2: ${{ secrets.CI_STRIPE_PRICE_ID_TIER_2 }}
   ```

   The remaining placeholders (ANTHROPIC*API_KEY, AWS*_, RESEND\__,
   INNGEST\_\*) stay — the e2e suite doesn't exercise those paths.

3. Commit + push. The next push should show both `CI` and `E2E` jobs
   running on the PR check list.

## Step 5: verify

From a new PR or commit on main:

```bash
gh run list --limit 2
# Expected: CI + E2E both running (or both completed success)
```

If e2e still fails, the most likely causes:

- **DB schema not applied** — re-run `pnpm prisma migrate deploy`
  against `DIRECT_URL` from Step 1.
- **RLS blocking inserts** — the estimator writes `Lead` rows with the
  anon key; if you've added RLS policies to prod but not to this test
  project, the insert fails silently.
- **Stripe price IDs mismatched** — the intake flow validates that the
  price ID returns a Stripe Product; a stale/invalid ID throws at
  runtime.

## Decommissioning

This test environment should be cheap to run indefinitely. If you ever
want to wipe it: delete the Supabase project from the dashboard. The
next push will fail CI with a clear "connection refused" that tells you
exactly what happened.
