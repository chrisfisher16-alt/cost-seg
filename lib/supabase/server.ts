import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * Server-side Supabase client scoped to the incoming request. Reads + writes
 * auth cookies so that session mutations (sign-in, sign-out, token refresh)
 * propagate to the browser.
 *
 * Must be called per-request. Do not cache across requests.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon } = env();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — cookies cannot be mutated there.
          // Middleware handles the refresh path; safe to ignore.
        }
      },
    },
  });
}

/**
 * Returns true when Supabase env vars are present. Use this to gate
 * auth-dependent UI in local dev without crashing.
 *
 * NOTE: Intentionally reads `process.env` directly rather than calling
 * `env()` — this is an existence-check used to feature-flag auth UI when
 * Supabase isn't configured. `env()` would throw on missing required vars
 * rather than return false, which is the opposite of the intended "probe
 * silently" behavior.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
