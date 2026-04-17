import "server-only";

import { Resend } from "resend";

let instance: Resend | null = null;

/**
 * Resend client singleton. Returns null when RESEND_API_KEY is missing so
 * callers can fall back to console logging in local dev.
 */
export function getResend(): Resend | null {
  if (instance) return instance;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  instance = new Resend(key);
  return instance;
}

export function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "Cost Seg <onboarding@resend.dev>";
}
