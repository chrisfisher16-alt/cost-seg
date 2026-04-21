import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS — never expose to the browser
 * and never pass user-provided filters without validation. Use only for
 * privileged operations (storage admin, inviting users, etc.).
 */
let instance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (instance) return instance;
  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = env();
  instance = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return instance;
}
