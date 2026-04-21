"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { classifyMagicLinkError } from "@/lib/auth/magic-link-error";
import { captureServer } from "@/lib/observability/posthog-server";
import { magicLinkLimiter } from "@/lib/ratelimit";
import { hashIp, resolveIp } from "@/lib/server/request-ip";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

export type SignInResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /**
       * Present only when Supabase throttled the send. The client uses this
       * to drive a countdown before re-enabling the submit button.
       */
      retryAfterSec?: number;
    };

const emailSchema = z.string().trim().min(3).max(254).email("Enter a valid email address.");

function callbackUrl(next: string | undefined): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";
  return `${origin}/auth/callback${qs}`;
}

/**
 * Email the visitor a magic link. Supabase throttles per-email with a
 * `status: 429` + "after N seconds" message — we classify the error so the
 * UI can show an honest countdown instead of a generic "try again shortly."
 *
 * The success response is identical whether or not the email belongs to a
 * real account (prevents email enumeration).
 */
export async function sendMagicLinkAction(
  email: string,
  next: string | undefined,
): Promise<SignInResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is not configured in this environment.",
    };
  }

  // Per-IP gate runs before Supabase's per-email throttle. A bot rotating
  // emails from a single IP would bypass Supabase's limit; this one stops
  // them at the front door. We hash the IP before using it as the key so
  // the Redis entry isn't PII-at-rest.
  const h = await headers();
  const ip = resolveIp(h);
  const gate = await magicLinkLimiter().check(hashIp(ip));
  if (!gate.ok) {
    const retryAfterSec = Math.max(1, Math.ceil((gate.resetAt - Date.now()) / 1000));
    return {
      ok: false,
      error: `Too many sign-in requests from this address — try again in ${retryAfterSec} ${
        retryAfterSec === 1 ? "second" : "seconds"
      }.`,
      retryAfterSec,
    };
  }

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: callbackUrl(next),
      shouldCreateUser: true,
    },
  });

  if (error) {
    const classified = classifyMagicLinkError(error);
    return {
      ok: false,
      error: classified.message,
      ...(classified.retryAfterSec !== null ? { retryAfterSec: classified.retryAfterSec } : {}),
    };
  }

  // Distinct-id is the email at this point (pre-sign-in, no user.id). PostHog
  // unifies the profile once the user signs in and the client-side capture
  // fires with the resolved Supabase user id.
  await captureServer(`email:${parsed.data}`, "sign_in_link_sent", {
    nextPath: next ?? null,
  });
  return { ok: true };
}

/**
 * Sign out the current user and bounce to the landing page. Called from a
 * <form action={signOutAction}> in the app header.
 */
export async function signOutAction() {
  if (!isSupabaseConfigured()) redirect("/");
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
