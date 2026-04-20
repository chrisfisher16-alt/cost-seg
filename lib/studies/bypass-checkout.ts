import "server-only";

import type Stripe from "stripe";

import type { PropertyType } from "@prisma/client";

import { encodeCheckoutMetadata } from "@/lib/stripe/checkout";
import { CATALOG, type Tier } from "@/lib/stripe/catalog";
import { handleCheckoutSessionCompleted } from "@/lib/studies/create-from-checkout";

interface BypassInput {
  tier: Tier;
  propertyType: PropertyType;
  email: string;
  /** Optional metadata forwarded the same way a real checkout would carry it. */
  addressLine?: string;
  purchasePriceCents?: number;
  /** When true we log the amount as charged on the StudyEvent (for traceable testing). */
  chargedAmountCents?: number;
  /** Optional friendly name — used as Supabase user_metadata on first creation. */
  fullName?: string;
}

/**
 * Create a Study + Property as if a Stripe checkout completed, bypassing the
 * payment. Guarded by `FISHER_PROMO_CODE` — the action layer verifies the
 * user-supplied code matches this env var before calling here.
 *
 * Returns the intake magic-link URL (the same URL the real welcome email
 * would include), so the caller can redirect the user straight in.
 */
export async function bypassCheckoutAndCreateStudy(
  input: BypassInput,
): Promise<{ studyId: string; redirectPath: string }> {
  const tierPriceCents = CATALOG[input.tier].priceCents;
  const amountTotal = input.chargedAmountCents ?? 0; // $0 — promo bypass, not a charge.

  // Use a deterministic-but-unique session id so the idempotency check in the
  // handler still works and a promo purchase can be distinguished from a real
  // Stripe session at the DB level (stripeSessionId column).
  const sessionId = `promo_${input.tier}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Minimal shape — handler reads: id, payment_status, metadata,
  // customer_email, customer_details.{email,name}, amount_total, currency.
  // Intentionally no metadata.userId — resolveOrCreateUser looks up /
  // creates by email, matching the real checkout path.
  const metadata = encodeCheckoutMetadata({
    tier: input.tier,
    propertyType: input.propertyType,
    addressLine: input.addressLine,
    purchasePriceCents: input.purchasePriceCents ? String(input.purchasePriceCents) : undefined,
  });
  // Flag-only marker so admin/analytics can tell promo studies from real
  // paid ones. Safe to add outside the CheckoutMetadata type — Stripe
  // metadata is an open string map.
  metadata.promoBypass = "1";

  const syntheticSession = {
    id: sessionId,
    payment_status: "no_payment_required" as const,
    amount_total: amountTotal,
    currency: "usd",
    customer_email: input.email,
    customer_details: {
      email: input.email,
      name: input.fullName ?? null,
    },
    metadata,
  } as unknown as Stripe.Checkout.Session;

  void tierPriceCents; // Reserved for future "record what this would have cost" telemetry.

  const studyId = await handleCheckoutSessionCompleted(syntheticSession);
  if (!studyId) {
    throw new Error("Study creation returned null — promo bypass produced no study.");
  }

  // Sign the buyer in server-side and return a relative redirect. The real
  // checkout path sends a magic link email — but the promo flow is for the
  // founder testing locally, so we skip the round-trip and set session
  // cookies directly on this response.
  await signInViaAdminMagicLink(input.email);

  return { studyId, redirectPath: `/studies/${studyId}/intake` };
}

/**
 * Generate a one-shot magic link via the admin API, then consume its
 * hashed_token server-side to set Supabase auth cookies on this response.
 * The user never sees the supabase.co domain — they get signed in in place.
 *
 * Only used by the promo bypass path. Real paid checkouts email the
 * action_link so the customer opens it in their own browser.
 */
async function signInViaAdminMagicLink(email: string): Promise<void> {
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  const { createServerSupabase } = await import("@/lib/supabase/server");

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error(`generateLink failed for ${email}: ${error?.message ?? "unknown"}`);
  }

  const server = await createServerSupabase();
  const { error: verifyError } = await server.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    throw new Error(`verifyOtp failed for ${email}: ${verifyError.message}`);
  }
}

/** True iff a promo bypass is possible on this deployment (env var set). */
export function promoBypassEnabled(): boolean {
  const code = process.env.FISHER_PROMO_CODE;
  return Boolean(code && code.trim().length > 0);
}

/** Verify a user-supplied code. Case-insensitive, trim-safe. */
export function promoCodeMatches(userInput: string): boolean {
  const expected = process.env.FISHER_PROMO_CODE?.trim();
  if (!expected) return false;
  return userInput.trim().toLowerCase() === expected.toLowerCase();
}
