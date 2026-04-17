# Local development

## Prerequisites

- Node 22+ (`node --version`)
- pnpm 10+ (`pnpm --version`). If missing: `curl -fsSL https://get.pnpm.io/install.sh | sh -`
- A Supabase project (free tier is fine for local dev)
- A Stripe account in test mode
- `stripe` CLI for webhook forwarding (`brew install stripe/stripe-cli/stripe`)

## First-time setup

```bash
pnpm install
cp .env.example .env.local
# fill in .env.local with real values — see §14 of the master prompt
pnpm prisma generate           # generate the Prisma client
pnpm prisma migrate dev --name init   # apply schema to your Supabase DB
```

## Running

```bash
pnpm dev              # Next.js on :3000
pnpm stripe:listen    # Stripe CLI webhook forwarding
pnpm inngest:dev      # Inngest local dev server (added in Phase 5)
```

## Checks before opening a PR

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e          # Playwright (requires a running dev server)
```

All must pass in both local and Vercel preview.

## Common issues

- **`PrismaClient is unable to be run in the browser`** — you imported
  `lib/db/client.ts` into a Client Component. Move the query into a Server
  Action or Route Handler.
- **Stripe webhook signature failure** — ensure `STRIPE_WEBHOOK_SECRET` matches
  the secret printed by `pnpm stripe:listen` (not the one in the Stripe
  Dashboard, which is for prod).
- **Environment variable missing** — `lib/env.ts` throws at first call. Check
  the stack trace for the specific var that failed validation.
