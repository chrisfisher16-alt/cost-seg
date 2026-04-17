# ADR 0005 — Canonical prices and Anthropic model IDs

Status: accepted, 2026-04-17

## Context

The master prompt gives inconsistent pricing (§1 `$295–$495` / §6.1 `$295` /
§15 `$395` for Tier 1; §1 `$1,295–$2,495` / §6.1 + §15 `$1,495` for Tier 2)
and pins a non-existent model ID (`claude-opus-4-6`). Need one canonical
source of truth for both to avoid divergence across Stripe, emails, and
PDFs.

## Decision

- **Tier 1 (AI Report):** `$295.00` (29500 cents). Most consistent with §6.1
  and the §15 margin math at the low end.
- **Tier 2 (Engineer-Reviewed):** `$1,495.00` (149500 cents). Matches §6.1
  and §15.
- Both prices live in `lib/stripe/catalog.ts` as the single source of truth.
  Stripe Price IDs are referenced by env var (`STRIPE_PRICE_ID_TIER_1`,
  `STRIPE_PRICE_ID_TIER_2`).
- **Anthropic model defaults (`lib/ai/models.ts`):**
  - `classifyDocument` → `claude-sonnet-4-6` (fast, cheap, high recall).
  - `decomposePurchasePrice` → `claude-opus-4-7`.
  - `classifyAssets` → `claude-opus-4-7` (core intellectual work; §15 hinges
    on this being good).
  - `draftNarrative` → `claude-opus-4-7`.
- Fallbacks: `claude-haiku-4-5-20251001` is allowed for retries on
  classification if Opus hits rate limits.
- Every call records the resolved model string in `AiAuditLog.model`. Model
  changes = new prompt version (see §7 prompting conventions).

## Consequences

- Margins tighten vs. §1 upper-bound pricing. Re-evaluate after 20 paid
  Tier 1 studies. This ADR is cheap to update.
- Pinning Opus 4.7 on Step C is the biggest cost lever. The rules-engine
  validator + one retry budget caps worst-case cost at ~2× per study.
