# Cost Seg

AI-powered cost segregation. Tier 1 software-generated modeling reports in
minutes; Tier 2 engineer-reviewed, audit-defensible studies in days.

Private and pre-V1. Single operator.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript strict
- Supabase (auth + private storage), Postgres via Prisma 7 (driver adapter
  pattern), app-layer authorization (see `docs/adr/0002-authz-without-rls.md`)
- Anthropic Claude for structured AI output (tool use only)
- AWS Textract for closing-disclosure OCR
- Stripe Checkout + webhook-driven fulfillment
- Resend + React Email for transactional mail
- Inngest for durable background jobs
- `@react-pdf/renderer` for deliverables
- Sentry (errors) + PostHog (product analytics)
- Vitest (unit), Playwright (e2e)

## Local dev

See [`docs/runbooks/local-dev.md`](docs/runbooks/local-dev.md).

## Phase status

V1 is being built phase by phase (see §9 of the master prompt):

- [x] Phase 0 — scaffolding
- [ ] Phase 1 — landing + estimator
- [ ] Phase 2 — auth + dashboards
- [ ] Phase 3 — Stripe + study creation
- [ ] Phase 4 — intake + document upload
- [ ] Phase 5 — OCR + AI pipeline
- [ ] Phase 6 — PDF + email delivery
- [ ] Phase 7 — admin dashboard + manual Tier 2 handoff
- [ ] Phase 8 — e2e hardening

## Decisions

Architecture decisions live in [`docs/adr/`](docs/adr). Read these before
making a change that touches schema, auth, storage, or AI prompting.
