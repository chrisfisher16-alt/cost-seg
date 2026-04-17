# V1 go-live checklist

Walk this top-to-bottom before the first paying customer. Complements
[`deploy.md`](./deploy.md) (which covers mechanics); this is the business +
legal + product posture check.

## Legal + scope posture

- [ ] `/(marketing)/page.tsx` footer scope disclosure is visible on every
      page (spot check in an incognito window).
- [ ] The Tier 1 AI Report PDF includes the verbatim `TIER_1_SCOPE_DISCLOSURE`
      on the cover, on page 2, and in the fixed footer. Generate one and
      open it.
- [ ] Welcome email + delivery email both include tier-specific caveat copy.
- [ ] Pricing copy in `lib/stripe/catalog.ts` matches the Stripe Product
      descriptions exactly. Re-read §15 of the master prompt if tempted to
      upsell here.

## Data + security

- [ ] Supabase `studies` bucket is **private** (`Public: off`).
- [ ] RLS is disabled on app tables (ADR 0002) and the service-role key is
      only in server env (`grep -r SUPABASE_SERVICE_ROLE_KEY` returns
      only server files).
- [ ] `.env.example` has no real secrets. Vercel project has every secret.
- [ ] `x-forwarded-for` is trusted for rate limiting (Vercel edge adds it).
- [ ] Sentry DSN is set; confirm a deliberate error reaches Sentry from prod.

## Payments + delivery

- [ ] Stripe Products for Tier 1 and Tier 2 are created in **live** mode
      and the env vars point at live Price IDs.
- [ ] Stripe webhook endpoint registered in **live** mode. Signing secret
      matches `STRIPE_WEBHOOK_SECRET`.
- [ ] Resend sending domain verified. `RESEND_FROM_EMAIL` uses the verified
      domain. A test email to your own inbox lands out of spam.
- [ ] `stripe listen` against prod webhook confirms our handler returns 200
      for `checkout.session.completed`.

## AI pipeline

- [ ] `ANTHROPIC_API_KEY` has enough monthly budget for the projected
      number of studies × ~$0.60 per Tier 1 (cover 3× projected).
- [ ] Asset libraries in `lib/ai/asset-library/*.json` have been re-read by
      a real human and reflect current industry ratios.
- [ ] Prompt templates in `lib/ai/prompts/*.ts` compile (covered by tests)
      and the tool schemas force structured output.
- [ ] A real end-to-end test study has been processed in prod from a test
      account and the output is something you'd proudly hand a CPA.

## Operations

- [ ] One admin account exists in `User` with `role = ADMIN`. You can
      reach `/admin` and see the pipeline board.
- [ ] Inngest Cloud sync shows `process-study` + `deliver-ai-report`
      functions listed and reachable.
- [ ] Vercel preview deploys are green for PRs (CI workflow).
- [ ] An engineer partner has agreed to accept Tier 2 studies and knows the
      handoff expectation (download draft, upload signed PDF via admin).

## Communication

- [ ] Landing page has a support email or contact link. A fallback reply-to
      is set on Resend for inbound customer replies.
- [ ] A privacy policy + terms are linked from the footer (out-of-scope V1
      if truly pre-launch; required before paid customers).

## Not required for V1 but review if present

- [ ] Analytics (PostHog) capturing the estimator funnel, sign-in, and
      delivery events.
- [ ] Backup plan for Supabase (daily backups enabled).
