"use server";

import { z } from "zod";

import { getOptionalAuth } from "@/lib/auth/require";
import { PROPERTY_TYPES } from "@/lib/estimator/types";
import { parseUsdInputToCents } from "@/lib/estimator/format";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { isStripeConfigured } from "@/lib/stripe/client";
import {
  bypassCheckoutAndCreateStudy,
  promoBypassEnabled,
  promoCodeMatches,
} from "@/lib/studies/bypass-checkout";

export type StartCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const inputSchema = z.object({
  tier: z.enum(["DIY", "AI_REPORT", "ENGINEER_REVIEWED"]),
  propertyType: z.enum(PROPERTY_TYPES),
  email: z.string().trim().toLowerCase().min(3).max(254).email(),
  addressLine: z.string().trim().max(480).optional(),
  purchasePriceRaw: z.string().optional(),
  /** Optional bypass code. Matched against FISHER_PROMO_CODE in the env. */
  promoCode: z.string().trim().max(128).optional(),
});

export async function startCheckoutAction(input: unknown): Promise<StartCheckoutResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { tier, propertyType, email, addressLine, purchasePriceRaw, promoCode } = parsed.data;
  const ctx = await getOptionalAuth();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // If the visitor is signed in with a different email, prefer their session
  // email so receipts / magic link match the account on file.
  const buyerEmail = ctx?.user.email ?? email;
  const purchasePriceCents = purchasePriceRaw ? parseUsdInputToCents(purchasePriceRaw) : null;

  // --- Promo bypass path -------------------------------------------------
  // Lets the founder (and anyone holding the FISHER_PROMO_CODE secret) test
  // the full post-purchase flow without Stripe keys configured.
  if (promoCode) {
    if (!promoBypassEnabled()) {
      return {
        ok: false,
        error: "Promo codes aren't enabled on this deployment. Set FISHER_PROMO_CODE to use this.",
      };
    }
    if (!promoCodeMatches(promoCode)) {
      return { ok: false, error: "That promo code isn't valid." };
    }
    try {
      const { redirectPath } = await bypassCheckoutAndCreateStudy({
        tier,
        propertyType,
        email: buyerEmail,
        addressLine: addressLine || undefined,
        purchasePriceCents: purchasePriceCents ?? undefined,
        fullName: ctx?.user.name ?? undefined,
      });
      // Relative path — the browser stays on localhost and Supabase session
      // cookies set during bypass are honored by the next request.
      return { ok: true, url: redirectPath };
    } catch (error) {
      console.error("checkout: promo bypass failed", error);
      return {
        ok: false,
        error:
          "Couldn't create the study via promo bypass. Check the server logs — the Supabase service role key and DB both need to be reachable.",
      };
    }
  }

  // --- Real Stripe path --------------------------------------------------
  if (!isStripeConfigured()) {
    return {
      ok: false,
      error:
        "Stripe is not configured in this environment. Set STRIPE_SECRET_KEY and the tier price IDs.",
    };
  }

  try {
    const session = await createCheckoutSession({
      tier,
      email: buyerEmail,
      origin,
      metadata: {
        tier,
        propertyType,
        userId: ctx?.user.id,
        addressLine: addressLine || undefined,
        purchasePriceCents: purchasePriceCents ? String(purchasePriceCents) : undefined,
      },
    });
    if (!session.url) {
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }
    return { ok: true, url: session.url };
  } catch (error) {
    console.error("checkout: failed to create session", error);
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
}

/**
 * Cheap helper the page can call at render-time to decide whether to show
 * the "I have a promo code" affordance. Safe for server-component usage.
 */
export async function isPromoBypassEnabledAction(): Promise<boolean> {
  return promoBypassEnabled();
}
