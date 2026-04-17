"use client";

import { createBrowserClient } from "@supabase/ssr";

let instance: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Singleton browser-side Supabase client. Safe to call repeatedly from
 * Client Components.
 */
export function getBrowserSupabase() {
  if (instance) return instance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase env missing on the client.");
  }
  instance = createBrowserClient(url, anon);
  return instance;
}
