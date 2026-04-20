# Deploy runbook

One-time Vercel + service setup, then the per-release checklist. V1 is
single-operator; optimize for "boring and repeatable" over clever.

## One-time: Vercel project

1. From the Vercel dashboard, import this repository.
2. Framework preset: **Next.js** (auto-detected). Root directory: `.`
3. Build command: `pnpm build`. Install command: `pnpm install`.
4. Fill in **every** env var from [`.env.example`](../../.env.example).
   - Mark the `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
     `STRIPE_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`, `INNGEST_SIGNING_KEY`,
     and AWS Textract keys as **Sensitive**.
   - Set `NEXT_PUBLIC_APP_URL` to the prod URL.
5. Deploy. First deploy will fail any `useActionState`/Stripe flow without
   keys — expected.

## One-time: Supabase

Follow [`supabase-bootstrap.md`](./supabase-bootstrap.md) for the
`studies` storage bucket and OAuth redirect URL setup. Then:

```bash
pnpm prisma migrate deploy
```

against the prod `DIRECT_URL` to apply migrations.

> **If migrate deploy errors on drift:** the live DB's `_prisma_migrations`
> history table got out of sync with the local `prisma/migrations/` folder
> (legacy names vs. Day-1-rebuild names). Follow
> [`migration-baseline.md`](./migration-baseline.md) for the five-step
> reconciliation before continuing.

## One-time: Stripe

1. Create two Stripe Products + Prices in the Stripe dashboard:
   - `AI Report` — $295, one-time, USD.
   - `Engineer-Reviewed Study` — $1,495, one-time, USD.
2. Copy the Price IDs into `STRIPE_PRICE_ID_TIER_1` and
   `STRIPE_PRICE_ID_TIER_2` for every environment.
3. Register a webhook endpoint in Stripe:
   - URL: `https://<prod>/api/stripe/webhook`
   - Events: `checkout.session.completed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## One-time: Inngest

1. Create a Cloud app at <https://app.inngest.com>, app id `cost-seg`.
2. Add the production Sync URL: `https://<prod>/api/inngest`.
3. Copy the event + signing keys into `INNGEST_EVENT_KEY` and
   `INNGEST_SIGNING_KEY` for every environment.

## One-time: Resend

1. Verify the sending domain in Resend.
2. Set `RESEND_FROM_EMAIL` to a `Cost Seg <notifications@...>` address.
3. Copy the API key into `RESEND_API_KEY`.

## Per-release checklist

Before merging to `main`:

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e` all green locally.
- [ ] If the Prisma schema changed, a migration is generated and committed.
- [ ] If a new env var is added, `.env.example` is updated and the deploy
      doc / Vercel project + preview + prod all have it filled in.
- [ ] ADR added under `docs/adr/` for any meaningful decision.

After merging (Vercel auto-deploys):

- [ ] Tail Vercel deploy logs until the build + post-deploy checks finish.
- [ ] Smoke the prod deploy per the post-deploy checklist below.
- [ ] Check Sentry for new issue clusters in the 10 minutes after deploy.

## Post-deploy smoke

From an incognito window:

1. **Landing** — `/` loads, estimator accepts $500,000 STR and returns a range.
2. **Sign-in** — `/sign-in` delivers a magic link; after verifying, bounce
   lands on `/dashboard`.
3. **Pricing → Stripe** — click `Start an AI Report`; the form posts and
   Stripe Checkout opens.
4. **Webhook (manual)** — use `stripe trigger checkout.session.completed`
   in the Stripe CLI pointed at prod; confirm a Study row is created and a
   welcome email arrives.
5. **Intake upload** — from the magic link, upload a sample closing
   disclosure + photo. Confirm the Inngest dashboard shows `process-study`
   running and the status lands on `AI_COMPLETE` (Tier 1) or
   `AWAITING_ENGINEER` (Tier 2).
6. **Delivery email (Tier 1)** — confirm the `ReportDeliveredEmail`
   arrives and the signed-URL download returns a valid PDF.
7. **Admin** — sign in as the admin user; `/admin` shows the new study;
   open the inspector; verify the AI audit trail has 4+ calls.

## Rolling back

- **Code regression** — redeploy the previous Vercel deployment from the
  dashboard (`Promote to Production` on an earlier build). Takes under a
  minute.
- **Schema regression** — Prisma migrate down is not supported; prefer
  fixing forward with a corrective migration. For emergencies: restore
  from Supabase daily backup.
- **Stripe mis-config** — flip `STRIPE_PRICE_ID_TIER_*` env vars back and
  redeploy; Stripe won't refund automatically, do it from the dashboard.
