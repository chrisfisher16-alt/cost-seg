import type { StudyStatus, Tier } from "@prisma/client";

/**
 * Per-status next-action hint surfaced on the dashboard StudyCard. Gives a
 * returning customer a one-line directive matching the study's state, so
 * they don't have to decode the status badge to know what to do next.
 *
 * Tone drives a small visual cue (primary = action available, muted = just
 * wait, warning = overdue, destructive = failed).
 */
export type ActionTone = "primary" | "muted" | "warning" | "destructive" | "success";

export interface NextAction {
  /** Short imperative directive shown in the card body. */
  hint: string;
  tone: ActionTone;
  /** True for statuses where the customer is actively blocking progress. */
  userOwned: boolean;
}

/**
 * Thresholds for flagging a study as "stuck" — copy in the hint reflects
 * the overdue state, not the happy-path copy.
 */
export const STUCK_AWAITING_DOCS_HOURS = 72; // 3 days idle in AWAITING_DOCUMENTS
export const STUCK_AWAITING_ENGINEER_HOURS = 7 * 24; // 7 days in AWAITING_ENGINEER
const HOUR_MS = 3_600_000;

/**
 * Decide the next action + tone for a study. `updatedAtMs` and `nowMs` drive
 * the stuck-state branch; pass them as numbers so the helper stays pure
 * (easy to unit-test without a clock mock).
 */
export function computeNextAction(input: {
  status: StudyStatus;
  tier: Tier;
  updatedAtMs: number;
  nowMs: number;
  missingRequiredDocs?: number;
}): NextAction {
  const { status, tier, updatedAtMs, nowMs, missingRequiredDocs } = input;
  const ageHours = (nowMs - updatedAtMs) / HOUR_MS;

  switch (status) {
    case "PENDING_PAYMENT":
      return {
        hint: "Complete checkout to start your study.",
        tone: "primary",
        userOwned: true,
      };

    case "AWAITING_DOCUMENTS": {
      const stuck = ageHours >= STUCK_AWAITING_DOCS_HOURS;
      if (tier === "DIY") {
        return {
          hint: stuck
            ? "Still waiting on your basis numbers — enter them to generate your report."
            : "Enter your basis and land value to generate the report.",
          tone: stuck ? "warning" : "primary",
          userOwned: true,
        };
      }
      const n = missingRequiredDocs ?? 0;
      const base =
        n > 0
          ? `Upload ${n} required document${n === 1 ? "" : "s"} to kick off the pipeline.`
          : "Confirm your property details to start processing.";
      return {
        hint: stuck ? `${base} (Waiting ${Math.floor(ageHours / 24)}d — ping us if stuck.)` : base,
        tone: stuck ? "warning" : "primary",
        userOwned: true,
      };
    }

    case "PROCESSING":
      return {
        hint: "Running the AI pipeline — usually minutes.",
        tone: "muted",
        userOwned: false,
      };

    case "AI_COMPLETE":
      return tier === "ENGINEER_REVIEWED"
        ? {
            hint: "AI pass done — queued for engineer review.",
            tone: "muted",
            userOwned: false,
          }
        : {
            hint: "AI pass done — delivery in progress.",
            tone: "muted",
            userOwned: false,
          };

    case "AWAITING_ENGINEER": {
      const stuck = ageHours >= STUCK_AWAITING_ENGINEER_HOURS;
      return {
        hint: stuck
          ? `Engineer review is running long (${Math.floor(ageHours / 24)}d) — we're chasing it.`
          : "Awaiting PE signature — 3–7 business days.",
        tone: stuck ? "warning" : "muted",
        userOwned: false,
      };
    }

    case "ENGINEER_REVIEWED":
      return {
        hint: "Signed by the engineer — final PDF rendering.",
        tone: "muted",
        userOwned: false,
      };

    case "DELIVERED": {
      const daysAgo = Math.max(0, Math.floor(ageHours / 24));
      return {
        hint:
          daysAgo === 0
            ? "Delivered today — download or share with your CPA."
            : daysAgo === 1
              ? "Delivered yesterday — download or share with your CPA."
              : `Delivered ${daysAgo} days ago.`,
        tone: "success",
        userOwned: false,
      };
    }

    case "FAILED":
      return {
        hint: "Pipeline failed — we've paused and our team is looking.",
        tone: "destructive",
        userOwned: false,
      };

    case "REFUNDED":
      return {
        hint: "Refunded — charge reversed on Stripe.",
        tone: "muted",
        userOwned: false,
      };
  }
}

/**
 * Format a relative age like "3 days ago" / "2 hours ago" for dashboard
 * StudyCard timestamps. Pure — pass explicit `nowMs`.
 */
export function formatRelativeAge(fromMs: number, nowMs: number): string {
  const deltaSec = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (deltaSec < 60) return "just now";
  if (deltaSec < 3600) {
    const m = Math.floor(deltaSec / 60);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (deltaSec < 86400) {
    const h = Math.floor(deltaSec / 3600);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(deltaSec / 86400);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const months = Math.floor(d / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
