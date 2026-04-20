import type { StudyStatus } from "@prisma/client";

/**
 * Human-readable label for a StudyStatus, plus a short one-line context
 * string the UI can surface to explain what that state actually means.
 *
 * Pure; safe to call from server components, client components, and unit
 * tests. Keep in sync with the map in components/shared/StatusBadge.tsx —
 * the badge colors live there, the words live here.
 */
const LABELS: Record<StudyStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  AWAITING_DOCUMENTS: "Upload needed",
  PROCESSING: "Processing",
  AI_COMPLETE: "AI complete",
  AWAITING_ENGINEER: "In engineer queue",
  ENGINEER_REVIEWED: "Engineer reviewed",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

const CONTEXT: Record<StudyStatus, string> = {
  PENDING_PAYMENT: "Checkout hasn't completed yet.",
  AWAITING_DOCUMENTS: "We're waiting on your intake documents.",
  PROCESSING: "The AI pipeline is running.",
  AI_COMPLETE: "AI draft finished — delivery next.",
  AWAITING_ENGINEER: "Queued for professional-engineer signature.",
  ENGINEER_REVIEWED: "Signed by the engineer — packaging final PDF.",
  DELIVERED: "Final PDF is ready to download.",
  FAILED: "Pipeline paused. Check the details below.",
  REFUNDED: "Charge was refunded on Stripe.",
};

/**
 * Returns the human label for a status. Falls back to a humanized version
 * of the raw enum value so unknown strings (forward-compatible with new
 * statuses we haven't mapped yet) still read cleanly.
 */
export function statusLabel(status: string): string {
  const known = LABELS[status as StudyStatus];
  if (known) return known;
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

export function statusContext(status: string): string | null {
  return CONTEXT[status as StudyStatus] ?? null;
}
