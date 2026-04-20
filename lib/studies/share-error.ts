/**
 * Translates a raw error message from `acceptShareByToken` into user-facing
 * copy with a specific recovery hint. Same shape/intent as
 * `classifyMagicLinkError` — keeps the failure page honest instead of
 * parroting "Share link not found." with no path forward.
 *
 * Pure. Never throws. Unknown shapes fall through to a generic kind that
 * still renders reasonable copy rather than leaving the UI blank.
 */

export type ShareErrorKind =
  | "not-found"
  | "revoked"
  | "wrong-account"
  | "invalid-email"
  | "generic";

export interface ClassifiedShareError {
  kind: ShareErrorKind;
  /** Short headline for the destructive Alert title. */
  title: string;
  /** One-sentence explanation the user reads under the headline. */
  hint: string;
  /**
   * Action-oriented recovery label + href. For `wrong-account` we point at
   * sign-out so the user can re-auth with the right email; for `not-found`
   * and `revoked` we point at the dashboard since only the original sender
   * can fix it.
   */
  recoveryLabel: string;
  recoveryHref: string;
}

/**
 * Pattern-match on the messages thrown from `lib/studies/share.ts`:
 *   - "Share link not found."
 *   - "This invitation has been revoked."
 *   - "This invitation was already accepted by a different account."
 *   - "Invalid email address."
 *
 * We match on distinctive phrases rather than exact strings so a future
 * edit to the message copy doesn't silently drop us to `generic`.
 */
export function classifyShareError(raw: unknown): ClassifiedShareError {
  const message = extractMessage(raw);

  if (/not found/i.test(message)) {
    return {
      kind: "not-found",
      title: "This share link doesn't work.",
      hint: "The link might be a typo, or the study owner may have cleaned up their shares. Ask the sender to forward a fresh invite.",
      recoveryLabel: "Back to dashboard",
      recoveryHref: "/dashboard",
    };
  }

  if (/revoked/i.test(message)) {
    return {
      kind: "revoked",
      title: "Access to this study was revoked.",
      hint: "The study owner removed this share — usually because they're re-doing an invite. Ask them to re-share once they're ready.",
      recoveryLabel: "Back to dashboard",
      recoveryHref: "/dashboard",
    };
  }

  if (/different account/i.test(message)) {
    return {
      kind: "wrong-account",
      title: "Already accepted by another account.",
      hint: "This invite was opened by a different email address on your team. Sign out and sign back in with the exact email the invite was sent to.",
      recoveryLabel: "Sign out",
      recoveryHref: "/sign-in?signout=1",
    };
  }

  if (/invalid email/i.test(message)) {
    return {
      kind: "invalid-email",
      title: "That invite was sent to a malformed address.",
      hint: "Ask the sender to re-send the invite to a valid email.",
      recoveryLabel: "Back to dashboard",
      recoveryHref: "/dashboard",
    };
  }

  return {
    kind: "generic",
    title: "We couldn't open that share.",
    hint:
      message ||
      "Something went wrong accepting the invite. If it keeps happening, email support@costseg.app with the URL.",
    recoveryLabel: "Back to dashboard",
    recoveryHref: "/dashboard",
  };
}

function extractMessage(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    const m = (raw as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}
