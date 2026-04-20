/**
 * Pure helpers for the share / share-invite flow. Split out from
 * `lib/studies/share.ts` (which is `import "server-only"` because it holds
 * Prisma-backed code) so client components like `ShareStudyDialog.tsx`
 * can import the format helpers without Next.js trying to bundle the pg
 * driver for the browser.
 *
 * Never import Prisma, `node:*`, or anything with `server-only`.
 */

/**
 * Canonicalize an email for equality comparison: trim + lowercase. Exposed
 * so callers and tests agree on the normalization used when deciding whether
 * an accepter's session email matches the invite's stored address.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * True iff the accepter's session email matches the invite's stored
 * `invitedEmail` (after normalization). Used to record the `emailMatched`
 * audit flag on the `share.accepted` StudyEvent so the admin inspector can
 * surface "invite went to A, accepted by B" cases.
 */
export function isAcceptedEmailMatch(
  invitedEmail: string | null | undefined,
  accepterEmail: string,
): boolean {
  if (!invitedEmail) return false;
  return normalizeEmail(invitedEmail) === normalizeEmail(accepterEmail);
}

/**
 * Human-readable "time remaining" for the share-invite cooldown button.
 *
 * The share invite limiter caps at 5 invites/hour, so `remainingSec` can be
 * anywhere from 1s to 3600s. The prior `Math.ceil(sec / 60) + "m"` format
 * was fine at 3600s but showed "1m" for a 30-second wait — the button would
 * re-enable 30s later while the label still promised a full minute. This
 * helper crosses the granularity boundary at 60s so the button text always
 * matches the actual wait within about a second.
 *
 * Never under-promises: 61s → "2m", not "1m", so a user glancing at the
 * button never clicks expecting seconds when minutes remain.
 */
export function formatShareCooldown(remainingSec: number): string {
  const sec = Math.max(0, Math.ceil(remainingSec));
  if (sec <= 0) return "0s";
  if (sec < 60) return `${sec}s`;
  const minutes = Math.ceil(sec / 60);
  return `${minutes}m`;
}
