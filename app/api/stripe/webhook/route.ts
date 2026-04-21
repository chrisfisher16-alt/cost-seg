import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { handleCheckoutSessionCompleted } from "@/lib/studies/create-from-checkout";
import { getStripe } from "@/lib/stripe/client";

/**
 * Stripe webhook endpoint. Signature-verified, idempotent at the
 * orchestrator level. Returns 200 for events we choose to ignore so Stripe
 * stops retrying.
 */
export async function POST(request: NextRequest) {
  // NOTE: direct `process.env` read instead of `env()` — this is a
  // feature-flag probe that returns 503 when Stripe isn't configured for
  // this environment (local dev, preview without Stripe keys). Going
  // through `env()` would still work because STRIPE_WEBHOOK_SECRET is
  // optional in the schema, but the explicit read keeps the intent clear:
  // "if this env var is unset, behave differently" is not an env() job.
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid";
    console.warn("[stripe webhook] signature check failed:", message);
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const studyId = await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        return NextResponse.json({ received: true, studyId });
      }
      // V1 ignores all other events — we still 200 so Stripe stops retrying.
      default:
        return NextResponse.json({ received: true, ignored: event.type });
    }
  } catch (err) {
    console.error("[stripe webhook] handler threw", err);
    // Returning 500 makes Stripe retry.
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }
}
