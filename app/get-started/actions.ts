"use server";

import { z } from "zod";

import { getOptionalAuth } from "@/lib/auth/require";
import { PROPERTY_TYPES } from "@/lib/estimator/types";
import { parseUsdInputToCents } from "@/lib/estimator/format";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { isStripeConfigured } from "@/lib/stripe/client";

export type StartCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const inputSchema = z.object({
  tier: z.enum(["DIY", "AI_REPORT", "ENGINEER_REVIEWED"]),
  propertyType: z.enum(PROPERTY_TYPES),
  email: z.string().trim().toLowerCase().min(3).max(254).email(),
  addressLine: z.string().trim().max(480).optional(),
  purchasePriceRaw: z.string().optional(),
});

export async function startCheckoutAction(input: unknown): Promise<StartCheckoutResult> {
  if (!isStripeConfigured()) {
    return {
      ok: false,
      error:
        "Stripe is not configured in this environment. Set STRIPE_SECRET_KEY and the tier price IDs.",
    };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { tier, propertyType, email, addressLine, purchasePriceRaw } = parsed.data;
  const ctx = await getOptionalAuth();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // If the visitor is signed in with a different email, prefer their session
  // email so Stripe's receipt matches the account on file.
  const buyerEmail = ctx?.user.email ?? email;

  const purchasePriceCents = purchasePriceRaw ? parseUsdInputToCents(purchasePriceRaw) : null;

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
