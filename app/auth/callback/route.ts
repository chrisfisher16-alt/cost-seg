import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * OAuth + magic-link callback. Supabase redirects here with a `code` param
 * after the user clicks their magic link or approves Google OAuth. We
 * exchange the code for a session and bounce to `next` (or /dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/sign-in?error=callback`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=callback`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=callback`);
  }

  // Guard against open-redirect: only accept relative paths.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${safeNext}`);
}
