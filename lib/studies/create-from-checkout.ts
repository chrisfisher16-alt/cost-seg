import "server-only";

import type Stripe from "stripe";

import { getPrisma } from "@/lib/db/client";
import { sendWelcomeEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { captureServer } from "@/lib/observability/posthog-server";
import { decodeCheckoutMetadata } from "@/lib/stripe/checkout";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Process a completed Stripe Checkout session:
 *   1. idempotency check via Study.stripeSessionId uniqueness
 *   2. resolve/create the buyer as a Supabase Auth user + Prisma User
 *   3. materialize Property + Study in a single transaction
 *   4. issue a one-time magic link + send the welcome email
 *
 * Returns the created Study.id (or null if skipped as a duplicate / ignored).
 * The webhook endpoint converts thrown errors into a 500 so Stripe retries.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  const prisma = getPrisma();

  // Idempotency — Stripe retries aggressively on 5xx and duplicates on edge.
  const existing = await prisma.study.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true },
  });
  if (existing) return null;

  // Only provision fulfilled sessions.
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return null;
  }

  const meta = decodeCheckoutMetadata(session.metadata ?? null);
  if (!meta) {
    console.warn("[webhook] invalid/missing metadata", session.id);
    return null;
  }

  const email = session.customer_email ?? session.customer_details?.email ?? null;
  if (!email) {
    console.warn("[webhook] no customer email", session.id);
    return null;
  }

  const fullName = session.customer_details?.name ?? null;
  const userId = await resolveOrCreateUser(email, fullName, meta.userId);

  const purchasePriceCents = meta.purchasePriceCents
    ? Number.parseInt(meta.purchasePriceCents, 10)
    : 0;

  // Prefer the structured Places fields when we have them — the Property
  // table wants real city/state/zip, not a single freeform line. Fall back
  // to the raw address line (or the "(provided during intake)" placeholder
  // when nothing was captured) so the row is always creatable.
  const streetAddress = meta.streetAddress ?? meta.addressLine ?? "(provided during intake)";
  const city = meta.city ?? "";
  const state = meta.state ?? "XX"; // XX is the sentinel PropertyForm treats as "empty"
  const zip = meta.zip ?? "";

  const study = await prisma.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: {
        userId,
        address: streetAddress,
        city,
        state,
        zip,
        purchasePrice: purchasePriceCents ? purchasePriceCents / 100 : 0,
        acquiredAt: new Date(),
        propertyType: meta.propertyType,
      },
    });
    const s = await tx.study.create({
      data: {
        userId,
        propertyId: property.id,
        tier: meta.tier,
        status: "AWAITING_DOCUMENTS",
        pricePaidCents: session.amount_total ?? 0,
        stripeSessionId: session.id,
      },
      select: { id: true },
    });
    await tx.studyEvent.create({
      data: {
        studyId: s.id,
        kind: "checkout.completed",
        payload: {
          sessionId: session.id,
          amountTotal: session.amount_total ?? null,
          currency: session.currency ?? null,
          customerEmail: email,
        },
      },
    });
    return s;
  });

  const intakeUrl = await generateIntakeMagicLink(email, study.id);
  try {
    await sendWelcomeEmail({
      to: email,
      firstName: fullName ? fullName.split(" ")[0] : null,
      tier: meta.tier,
      intakeUrl,
    });
  } catch (err) {
    // Email failure shouldn't reverse the Study — admin can resend manually.
    console.error("[webhook] welcome email failed", err);
  }

  await captureServer(userId, "study_created", {
    studyId: study.id,
    tier: meta.tier,
    propertyType: meta.propertyType,
    pricePaidCents: session.amount_total ?? 0,
    promoBypass: session.metadata?.promoBypass === "1",
  });

  return study.id;
}

/**
 * Resolve the buyer to a Supabase Auth UUID, creating the record if they
 * haven't signed up before. The UUID doubles as our Prisma `User.id`.
 */
async function resolveOrCreateUser(
  email: string,
  name: string | null,
  priorUserId: string | undefined,
): Promise<string> {
  const prisma = getPrisma();

  if (priorUserId) {
    // Signed-in buyer — the id is authoritative. Still sync metadata.
    await prisma.user.upsert({
      where: { id: priorUserId },
      update: { email, name },
      create: { id: priorUserId, email, name },
    });
    return priorUserId;
  }

  const byEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: name ? { name } : undefined,
  });

  let supabaseUserId: string | null = data?.user?.id ?? null;

  if (error || !supabaseUserId) {
    // Race: another webhook created the user first, or Supabase reported
    // "email already exists". Fall back to a paginated listUsers lookup
    // — a single 200-row page used to be enough for V1's solo-operator
    // scale, but as the project grows past that a needle-in-page-2 race
    // would silently throw "Could not create or find." Iterate pages
    // until we find the match or exhaust results.
    supabaseUserId = await findSupabaseUserByEmail(admin, email);
    if (!supabaseUserId) {
      throw new Error(
        `Could not create or find Supabase user for ${email}: ${error?.message ?? "unknown"}`,
      );
    }
  }

  await prisma.user.upsert({
    where: { id: supabaseUserId },
    update: { email, name },
    create: { id: supabaseUserId, email, name },
  });
  return supabaseUserId;
}

/** Cap on pages we'll walk during a listUsers lookup. 50 pages × 200
 * users = 10k, an order of magnitude past the operator's current total
 * and plenty of headroom before the cap becomes the failure mode.
 * If the real answer is "user exists past the cap," we'd rather throw
 * a clear error than silently fall through. */
const LIST_USERS_MAX_PAGES = 50;

/**
 * Walk Supabase's paginated listUsers until we find a match or exhaust
 * results. Returns null when no user with `email` exists. Closes B3-2
 * (Bucket 3): before this, we did a single `listUsers({ perPage: 200 })`
 * call and assumed the target was on page 1. A concurrent-webhook race
 * where the racing user isn't in the first 200 would silently fail.
 */
async function findSupabaseUserByEmail(
  admin: ReturnType<typeof getSupabaseAdmin>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= LIST_USERS_MAX_PAGES; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    // Supabase returns `nextPage: 0` (falsy) when there's no next page.
    // We treat both "< perPage results" and "nextPage missing" as terminal.
    if (users.length < 200) return null;
  }
  // Exhausted the safety cap — surface it to the caller as "not found"
  // rather than silently spinning forever.
  return null;
}

async function generateIntakeMagicLink(email: string, studyId: string): Promise<string> {
  const admin = getSupabaseAdmin();
  const { NEXT_PUBLIC_APP_URL: appUrl } = env();
  const next = `/studies/${studyId}/intake`;
  const redirectTo = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error || !data?.properties?.action_link) {
    throw new Error(`generateLink failed for ${email}: ${error?.message ?? "unknown"}`);
  }
  return data.properties.action_link;
}
