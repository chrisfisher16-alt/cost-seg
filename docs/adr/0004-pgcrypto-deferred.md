# ADR 0004 — Application-layer encryption deferred

Status: accepted, 2026-04-17

## Context

§12 of the master prompt calls for `pgcrypto` on sensitive fields inside
`documents.extractedJson`. Supabase Postgres already encrypts data at rest
at the volume level (AES-256) and TLS encrypts in transit. Application-layer
envelope encryption adds value against a compromised service-role key or a
SQL-injection read, but requires a real key-management story (AWS KMS or
Supabase Vault) that V1 doesn't have infrastructure for yet.

Additionally, the V1 inputs (closing disclosures, improvement receipts,
photos) typically contain buyer name + property address but not SSNs, DOBs,
or bank account numbers. The §12 prompt-scrubbing requirement covers the
outbound-to-Claude risk separately in `lib/ai/scrub.ts`.

## Decision

V1 does NOT encrypt fields at the application layer. It relies on:

- Supabase volume-level encryption at rest.
- TLS 1.2+ in transit.
- Private storage buckets + signed URLs.
- PII scrubbing before every Claude call (`lib/ai/scrub.ts` — implemented in
  Phase 5).
- App-layer auth + ownership checks (ADR 0002).

## Consequences

- A leaked service-role key or a SQL-injection read discloses plaintext
  documents and parsed JSON. Mitigations: service-role key only in server
  env, Prisma parameterized queries, no dynamic SQL.

## Upgrade trigger

- First document kind that contains SSN / full DOB / bank account.
- First contract requiring field-level encryption or BYOK.
- First SOC 2 readiness review.

When triggered: provision AWS KMS CMK, add `lib/crypto/envelope.ts`
(encrypt/decrypt with data key, wrap data key with CMK), and re-key
`documents.extractedJson` + any newly-sensitive `Property` fields.
