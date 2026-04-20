/**
 * Classifies Supabase auth errors coming back from `signInWithOtp` into
 * user-facing buckets with honest copy.
 *
 * The primary win is detecting the per-email throttle Supabase enforces on
 * magic-link sends. Without this, the user sees a generic "try again shortly"
 * and mashes the button, which just resets the cooldown. With this, the UI
 * can show an exact countdown and disable the button until it elapses.
 *
 * Pure. Never throws — unknown error shapes fall through to `generic`.
 */

export type MagicLinkErrorKind =
  | "rate-limited"
  | "invalid-email"
  | "disabled"
  | "transport"
  | "generic";

export interface ClassifiedMagicLinkError {
  kind: MagicLinkErrorKind;
  /** One-line, user-facing. Safe to show verbatim. */
  message: string;
  /**
   * When `kind === "rate-limited"`, how many seconds the caller should wait
   * before re-enabling the send button. `null` for all other kinds.
   */
  retryAfterSec: number | null;
}

interface AuthErrorLike {
  message?: unknown;
  status?: unknown;
  code?: unknown;
}

/**
 * Supabase returns one of:
 *   { status: 429, code: "over_email_send_rate_limit",
 *     message: "For security purposes, you can only request this after 48 seconds." }
 *   { status: 429, code: "email_send_rate_limit",  ...similar message }
 *
 * Older SDKs only set `status` (no `code`). We match on both.
 */
export function classifyMagicLinkError(err: unknown): ClassifiedMagicLinkError {
  if (!err || typeof err !== "object") {
    return {
      kind: "generic",
      message: "Could not send the magic link. Try again shortly.",
      retryAfterSec: null,
    };
  }

  const e = err as AuthErrorLike;
  const status = typeof e.status === "number" ? e.status : null;
  const code = typeof e.code === "string" ? e.code : null;
  const message = typeof e.message === "string" ? e.message : "";

  // ---------- rate-limited ----------
  const isRateLimited =
    status === 429 ||
    code === "over_email_send_rate_limit" ||
    code === "email_send_rate_limit" ||
    /rate limit/i.test(message) ||
    /after \d+ seconds/i.test(message);

  if (isRateLimited) {
    const retryAfterSec = parseRetryAfterSec(message);
    return {
      kind: "rate-limited",
      message:
        retryAfterSec && retryAfterSec > 0
          ? `Supabase limits how often we can email a magic link — try again in ${retryAfterSec} ${
              retryAfterSec === 1 ? "second" : "seconds"
            }.`
          : "Supabase is throttling magic-link emails — wait about a minute and try again.",
      retryAfterSec: retryAfterSec ?? 60,
    };
  }

  // ---------- disabled / configuration ----------
  if (
    code === "signup_disabled" ||
    code === "email_provider_disabled" ||
    /provider is not enabled/i.test(message)
  ) {
    return {
      kind: "disabled",
      message: "Email sign-in is disabled for this project. Reach out to support@segra.tax.",
      retryAfterSec: null,
    };
  }

  // ---------- invalid-email ----------
  if (code === "validation_failed" || code === "invalid_email" || /invalid.*email/i.test(message)) {
    return {
      kind: "invalid-email",
      message: "That email address looks off — double-check the spelling.",
      retryAfterSec: null,
    };
  }

  // ---------- transport ----------
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /fetch failed/i.test(message) ||
    /network/i.test(message) ||
    /ECONNREFUSED/.test(message)
  ) {
    return {
      kind: "transport",
      message: "Couldn't reach the sign-in service. Check your connection and try again.",
      retryAfterSec: null,
    };
  }

  return {
    kind: "generic",
    message: "Could not send the magic link. Try again shortly.",
    retryAfterSec: null,
  };
}

/**
 * Pulls the "N seconds" out of Supabase throttle messages like:
 *   "For security purposes, you can only request this after 48 seconds."
 * Returns `null` when the message is silent about the cooldown.
 */
function parseRetryAfterSec(message: string): number | null {
  const m = /after (\d+) seconds?/i.exec(message);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}
