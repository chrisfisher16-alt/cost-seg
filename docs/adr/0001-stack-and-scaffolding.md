# ADR 0001 — Stack and scaffolding for V1

Status: accepted, 2026-04-17

## Context

The master prompt (§3) fixes the stack. Pinning these choices here creates a
single place to revisit when a real tradeoff surfaces.

## Decision

- **Runtime:** Next.js 16.2.4 App Router (not 15 as §3 specified — 16 is the
  current stable as of April 2026 and was installed by `create-next-app@latest`).
  Turbopack ships as the default builder in 16. Flagged to the project owner;
  staying on 16 unless an incompatibility emerges.
- **React 19.2** (Server Components default, `use` hook, actions stable).
- **TypeScript 5.9**, `strict: true`, `moduleResolution: bundler`.
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme inline`), shadcn/ui
  added on demand, `clsx` + `tailwind-merge` + `cva` for component variants.
- **Database:** Supabase Postgres. Prisma 6 for schema + typed queries; Supabase
  SDK (`@supabase/supabase-js`, `@supabase/ssr`) for auth + storage only.
- **Background jobs:** Inngest. No ad-hoc `setTimeout` or Vercel cron for the
  study pipeline.
- **Email:** Resend + React Email.
- **PDFs:** `@react-pdf/renderer`.
- **Observability:** Sentry (errors) + PostHog (product analytics).
- **Package manager:** pnpm 10.33 (installed via the standalone script —
  corepack required sudo).

## Consequences

- Next 16 has behavioral changes from training data. Read
  `node_modules/next/dist/docs/` before touching a Next API. See
  `AGENTS.md` in the repo root (auto-generated rule).
- Tailwind v4 CSS-first config means no `tailwind.config.ts`. Theme lives in
  `app/globals.css` under `@theme inline`.
- Turbopack is default in `next dev` and `next build`. If an issue emerges we
  can fall back with `--webpack`.
