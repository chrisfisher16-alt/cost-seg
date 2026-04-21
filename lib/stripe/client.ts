import "server-only";

import Stripe from "stripe";

import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";
import { CATALOG } from "@/lib/stripe/catalog";

let instance: Stripe | null = null;

/**
 * Stripe SDK singleton. Throws via `env()` when `STRIPE_SECRET_KEY` or any
 * other required var is missing so callers see a clear boot-level error
 * instead of a downstream Stripe-SDK exception.
 *
 * The Stripe SDK is server-only and should never ship to the client bundle.
 */
export function getStripe(): Stripe {
  if (instance) return instance;
  const { STRIPE_SECRET_KEY } = env();
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required to use the Stripe client.");
  }
  // `appInfo.name` surfaces in Stripe dashboards, webhook event logs, and
  // billing reports — keyed on BRAND.name so it follows a rebrand rather
  // than leaking the internal npm package slug.
  instance = new Stripe(STRIPE_SECRET_KEY, {
    typescript: true,
    appInfo: { name: BRAND.name, version: "0.1.0" },
  });
  return instance;
}

/**
 * "Can we actually take money right now?" — true iff we have STRIPE_SECRET_KEY
 * *and* a price id for every tier in the catalog. Derived from CATALOG so a
 * new tier added there extends this check automatically; otherwise we'd ship
 * a deployment where (say) the /get-started form renders the tier but the
 * createCheckoutSession call blows up at the Stripe API with a vague 500 the
 * user reads as "Could not start checkout. Please try again."
 *
 * NOTE: Intentionally reads `process.env` directly rather than going through
 * `env()` — this is an existence-check used for feature-flagging the
 * `/get-started` form render. `env()` would throw on missing required vars
 * rather than return false, which would take down the marketing site during
 * local dev when Stripe isn't configured.
 */
export function isStripeConfigured(): boolean {
  if (!process.env.STRIPE_SECRET_KEY) return false;
  return Object.values(CATALOG).every((entry) => Boolean(process.env[entry.stripePriceIdEnv]));
}
