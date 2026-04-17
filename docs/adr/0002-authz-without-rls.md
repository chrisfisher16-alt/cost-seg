# ADR 0002 — Authorization without Supabase RLS

Status: accepted, 2026-04-17

## Context

Prisma connects to Supabase Postgres with the `postgres` role (service-role
credentials). RLS policies don't apply to that role — any RLS we add is purely
a second-layer check that only kicks in if someone also uses the Supabase
client to query the same table. §3 splits the clients: Supabase SDK only for
auth + storage, Prisma for everything else. So no query path exists on which
RLS would actually run.

Maintaining two enforcement models (RLS + app-layer) doubles the mental model
and the audit surface while, in our topology, only the app layer can block an
unauthorized read.

## Decision

- Disable RLS on all Prisma-managed tables.
- Enforce every authorization check in application code:
  - `lib/auth/requireAuth(request)` — rejects unauthenticated requests.
  - `lib/auth/requireRole(["ADMIN"])` — admin gate for `/(admin)` routes +
    admin APIs.
  - `lib/auth/assertOwnership(userId, resource)` — must be called in every
    handler that reads or writes `Study`, `Property`, or `Document`.
- Every Prisma query against a user-owned resource includes an explicit
  `where: { userId }` predicate. Code review + lint custom rule (future) will
  enforce.
- The service-role key never leaves server code. Marked in `lib/*` with the
  `server-only` import where relevant.

## Consequences

- A single bug in an app-layer check is the whole breach — no RLS backstop.
  Mitigations: central helpers, ownership unit tests, audit log on every
  admin read of someone else's study.
- If we later expose a Supabase-client query path (e.g., signed realtime
  channels), we revisit this ADR and add RLS for those specific tables before
  shipping that feature.

## Upgrade trigger

- First enterprise customer with a "must have DB-layer RLS" requirement, or
- First feature that reads user data via the Supabase client directly.
