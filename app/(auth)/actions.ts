"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

export type SignInResult = { ok: true } | { ok: false; error: string };

const emailSchema = z.string().trim().min(3).max(254).email("Enter a valid email address.");

function callbackUrl(next: string | undefined): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qs = next ? `?next=${encodeURIComponent(next)}` : "";
  return `${origin}/auth/callback${qs}`;
}

/**
 * Email the visitor a magic link. Supabase throttles per-email, so we don't
 * add our own rate limit here; the browser shows a "check your email"
 * confirmation regardless of whether the account exists (prevents email
 * enumeration).
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
    return { ok: false, error: "Could not send the magic link. Try again shortly." };
  }
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
