import "server-only";

import Stripe from "stripe";

import { BRAND } from "@/lib/brand";

let instance: Stripe | null = null;

/**
 * Stripe SDK singleton. Throws when STRIPE_SECRET_KEY is missing so callers
 * can surface a clear "not configured" error in dev.
 *
 * The Stripe SDK is server-only and should never ship to the client bundle.
 */
export function getStripe(): Stripe {
  if (instance) return instance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is required to use the Stripe client.");
  }
  // `appInfo.name` surfaces in Stripe dashboards, webhook event logs, and
  // billing reports — keyed on BRAND.name so it follows a rebrand rather
  // than leaking the internal npm package slug.
  instance = new Stripe(key, {
    typescript: true,
    appInfo: { name: BRAND.name, version: "0.1.0" },
  });
  return instance;
}

export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_ID_TIER_1 &&
    process.env.STRIPE_PRICE_ID_TIER_2,
  );
}
