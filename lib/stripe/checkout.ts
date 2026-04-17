import "server-only";

import type Stripe from "stripe";

import { CATALOG, type Tier } from "./catalog";
import { getStripe } from "./client";

/**
 * Shape we stash on the Stripe Checkout session so the webhook can
 * materialize the User + Property + Study without a DB round-trip to find
 * pending intent rows.
 *
 * Stripe caps metadata at 50 keys and 500 chars per value. Keep this small.
 */
export interface CheckoutMetadata {
  tier: Tier;
  propertyType:
    | "SINGLE_FAMILY_RENTAL"
    | "SHORT_TERM_RENTAL"
    | "SMALL_MULTIFAMILY"
    | "MID_MULTIFAMILY"
    | "COMMERCIAL";
  /** Supabase/Prisma User.id when the buyer was signed in at checkout. */
  userId?: string;
  /** Free-text address captured on /get-started. Optional. */
  addressLine?: string;
  /** Purchase price in cents, captured on /get-started. Optional. */
  purchasePriceCents?: string; // Stripe metadata values must be strings
}

export function encodeCheckoutMetadata(meta: CheckoutMetadata): Record<string, string> {
  const out: Record<string, string> = {
    tier: meta.tier,
    propertyType: meta.propertyType,
  };
  if (meta.userId) out.userId = meta.userId;
  if (meta.addressLine) out.addressLine = meta.addressLine.slice(0, 480);
  if (meta.purchasePriceCents) out.purchasePriceCents = meta.purchasePriceCents;
  return out;
}

export function decodeCheckoutMetadata(raw: Stripe.Metadata | null): CheckoutMetadata | null {
  if (!raw) return null;
  const tier = raw.tier;
  const propertyType = raw.propertyType;
  if (tier !== "AI_REPORT" && tier !== "ENGINEER_REVIEWED") return null;
  if (
    propertyType !== "SINGLE_FAMILY_RENTAL" &&
    propertyType !== "SHORT_TERM_RENTAL" &&
    propertyType !== "SMALL_MULTIFAMILY" &&
    propertyType !== "MID_MULTIFAMILY" &&
    propertyType !== "COMMERCIAL"
  ) {
    return null;
  }
  return {
    tier,
    propertyType,
    userId: raw.userId || undefined,
    addressLine: raw.addressLine || undefined,
    purchasePriceCents: raw.purchasePriceCents || undefined,
  };
}

export interface CreateCheckoutArgs {
  tier: Tier;
  email: string;
  metadata: CheckoutMetadata;
  origin: string;
}

export async function createCheckoutSession({
  tier,
  email,
  metadata,
  origin,
}: CreateCheckoutArgs): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const entry = CATALOG[tier];
  const priceId = process.env[entry.stripePriceIdEnv];
  if (!priceId) {
    throw new Error(`${entry.stripePriceIdEnv} is not set — cannot start a ${tier} checkout.`);
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    success_url: `${origin}/get-started/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/get-started?tier=${tier}&cancelled=1`,
    metadata: encodeCheckoutMetadata(metadata),
    payment_intent_data: {
      metadata: encodeCheckoutMetadata(metadata),
    },
    allow_promotion_codes: true,
  });
}
