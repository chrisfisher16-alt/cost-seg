import "server-only";

import Stripe from "stripe";

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
  instance = new Stripe(key, {
    typescript: true,
    appInfo: { name: "cost-seg", version: "0.1.0" },
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
