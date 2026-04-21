import "server-only";

import { Resend } from "resend";

import { BRAND } from "@/lib/brand";
import { env } from "@/lib/env";

let instance: Resend | null = null;

/**
 * Resend client singleton. Returns null when RESEND_API_KEY is missing so
 * callers can fall back to console logging in local dev.
 */
export function getResend(): Resend | null {
  if (instance) return instance;
  const { RESEND_API_KEY } = env();
  if (!RESEND_API_KEY) return null;
  instance = new Resend(RESEND_API_KEY);
  return instance;
}

export function getFromAddress(): string {
  return env().RESEND_FROM_EMAIL ?? `${BRAND.name} <onboarding@resend.dev>`;
}
