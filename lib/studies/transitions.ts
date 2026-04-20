import "server-only";

import type { Prisma, StudyStatus, Tier } from "@prisma/client";

import { getPrisma } from "@/lib/db/client";

/**
 * Single source of truth for `Study.status` state changes. Every write to
 * `Study.status` in the codebase must go through `transitionStudy` so the
 * legal-transition graph in master-prompt §2.3 is enforced at one seam
 * instead of being re-derived (and occasionally bent) per call site.
 *
 * Graph — per tier:
 *
 *   DIY:            PENDING_PAYMENT → AWAITING_DOCUMENTS → AI_COMPLETE → DELIVERED
 *   AI_REPORT:      PENDING_PAYMENT → AWAITING_DOCUMENTS → PROCESSING → AI_COMPLETE → DELIVERED
 *   ENGINEER_REVIEWED:
 *                   PENDING_PAYMENT → AWAITING_DOCUMENTS → PROCESSING → AWAITING_ENGINEER
 *                                   → ENGINEER_REVIEWED → DELIVERED
 *
 * Recovery / terminal:
 *
 *   Any non-REFUNDED state → FAILED      (with failedReason)
 *   Any state              → REFUNDED    (terminal)
 *   FAILED → PROCESSING                   (admin rerun)
 *   DELIVERED is terminal except for REFUNDED
 *   REFUNDED is terminal
 *
 * DIY's AWAITING_DOCUMENTS → AI_COMPLETE hop is DIY-tier-only. Before this
 * SSOT existed, `app/(app)/studies/[id]/diy/actions.ts` was the only code
 * enforcing that rule locally — an admin rerun or pipeline bug could have
 * silently pushed a Tier 1/2 study through the same edge.
 *
 * `isLegalTransition(from, to, tier?)` is pure; callers that want to make a
 * decision without committing the write (e.g. admin-UI guards) can call it
 * directly. `transitionStudy({ studyId, from, to, tier, extraData, tx })`
 * performs the atomic write — single `updateMany` whose WHERE clause
 * includes the expected current status so a concurrent writer can't slip a
 * stale transition past us.
 *
 * Interactive `$transaction(async (tx) => ...)` callers pass `tx`; batched
 * `$transaction([...])` callers cannot use this helper (the count-check
 * must be able to throw mid-transaction) and must be refactored to the
 * interactive form before migrating.
 */

// ---- legal-transition graph --------------------------------------------

/**
 * Forward edges reachable from a given status, ignoring the universal
 * FAILED / REFUNDED destinations (those are checked separately in
 * `isLegalTransition` so terminal-state semantics are obvious at a glance).
 * Entries with a `tier` key are tier-specific — only that tier may use that
 * edge.
 */
type Edge = { to: StudyStatus; tier?: Tier };

const FORWARD_EDGES: Record<StudyStatus, readonly Edge[]> = {
  PENDING_PAYMENT: [{ to: "AWAITING_DOCUMENTS" }],
  AWAITING_DOCUMENTS: [
    // Tier 1/2 go through PROCESSING.
    { to: "PROCESSING", tier: "AI_REPORT" },
    { to: "PROCESSING", tier: "ENGINEER_REVIEWED" },
    // DIY synthesizes AI_COMPLETE on form submit — no AI pipeline runs.
    { to: "AI_COMPLETE", tier: "DIY" },
  ],
  PROCESSING: [
    // Tier 1 finishes with AI_COMPLETE; Tier 2 branches to AWAITING_ENGINEER.
    { to: "AI_COMPLETE", tier: "AI_REPORT" },
    // DIY's synthetic AI_COMPLETE path can also land in AI_COMPLETE if a
    // future admin rerun ever puts a DIY study through PROCESSING (not
    // today's flow, but keeping the door open avoids lock-in).
    { to: "AI_COMPLETE", tier: "DIY" },
    { to: "AWAITING_ENGINEER", tier: "ENGINEER_REVIEWED" },
  ],
  AI_COMPLETE: [{ to: "DELIVERED" }],
  AWAITING_ENGINEER: [{ to: "ENGINEER_REVIEWED" }],
  ENGINEER_REVIEWED: [{ to: "DELIVERED" }],
  DELIVERED: [],
  FAILED: [
    // Admin rerun path — kick a failed study back to PROCESSING. DIY doesn't
    // use PROCESSING, so DIY failures can only exit via REFUNDED.
    { to: "PROCESSING", tier: "AI_REPORT" },
    { to: "PROCESSING", tier: "ENGINEER_REVIEWED" },
  ],
  REFUNDED: [],
};

/**
 * Pure check — `true` iff moving a study from `from` to `to` is permitted
 * by the legal-transition graph. Caller-facing error-path predicate for
 * admin UI gating; the DB-side enforcement is in `transitionStudy`.
 *
 * `tier` is optional. When omitted, any tier-specific edge is permitted;
 * tier-gating is only enforced when the caller actually knows the tier.
 * Most production callers have a Study row in hand so they can always pass
 * tier — `transitionStudy` asks for it explicitly.
 */
export function isLegalTransition(from: StudyStatus, to: StudyStatus, tier?: Tier): boolean {
  // No-op is never legal — force callers to notice the read-before-write.
  if (from === to) return false;

  // REFUNDED is reachable from anywhere (including DELIVERED) — it's the
  // refund bookkeeping status, not a rollback.
  if (to === "REFUNDED") return from !== "REFUNDED";

  // FAILED is reachable from any in-flight status, but not from the two
  // terminals. Tier is irrelevant for the failure escape hatch.
  if (to === "FAILED") {
    return from !== "REFUNDED" && from !== "DELIVERED" && from !== "FAILED";
  }

  // Forward / recovery edges.
  const edges = FORWARD_EDGES[from];
  for (const edge of edges) {
    if (edge.to !== to) continue;
    if (!edge.tier) return true;
    if (tier === undefined) return true;
    if (edge.tier === tier) return true;
  }
  return false;
}

// ---- runtime mutator ---------------------------------------------------

/** Subset of Prisma.StudyUpdateInput that callers commonly need to set
 *  alongside the status flip (e.g. `failedReason`, `deliveredAt`,
 *  `deliverableUrl`, `engineerSignedAt`, `assetSchedule`). Kept structural
 *  so new fields flow through without edits here. */
export type TransitionExtraData = Prisma.StudyUpdateInput;

export interface TransitionStudyArgs {
  /** The study we're moving. */
  studyId: string;
  /**
   * Current status we expect. Pass an array to allow any of several —
   * useful for recovery paths (e.g. admin mark-failed permits any
   * non-terminal). The write is gated on this value in the DB WHERE, so a
   * concurrent writer who already transitioned the row will cause this
   * call to fail with a "refused" error rather than overwrite.
   */
  from: StudyStatus | readonly StudyStatus[];
  /** Target status. */
  to: StudyStatus;
  /** Tier, for tier-gated edges (AWAITING_DOCUMENTS → AI_COMPLETE etc). */
  tier?: Tier;
  /** Additional Study columns to set in the same row-update. */
  extraData?: TransitionExtraData;
  /**
   * An existing Prisma transaction client. Passing this makes the
   * transition participate in the caller's `$transaction(async (tx) => …)`
   * block so downstream writes (usually a StudyEvent.create) are atomic
   * with the status flip. Omit for standalone calls.
   */
  tx?: Prisma.TransactionClient;
}

/**
 * Atomically transition a Study. Throws when:
 *   • the (from, to, tier) triple is not in the legal graph, or
 *   • no row with `id` + current status in `from` exists (study not found
 *     or already transitioned by another writer).
 */
export async function transitionStudy(args: TransitionStudyArgs): Promise<void> {
  const { studyId, to, tier, extraData, tx } = args;
  const fromArr: readonly StudyStatus[] = Array.isArray(args.from) ? args.from : [args.from];

  // Static legal-transition check first — no DB hit for illegal callers.
  for (const from of fromArr) {
    if (!isLegalTransition(from, to, tier)) {
      throw new Error(
        `transitionStudy: illegal transition ${from} → ${to}` + (tier ? ` (tier=${tier})` : ""),
      );
    }
  }

  const client = tx ?? getPrisma();
  const result = await client.study.updateMany({
    where: {
      id: studyId,
      status: { in: fromArr as StudyStatus[] },
    },
    data: { status: to, ...(extraData ?? {}) },
  });

  if (result.count === 0) {
    throw new Error(
      `transitionStudy: refused to move study ${studyId} to ${to} — ` +
        `current status not in [${fromArr.join(", ")}] (study missing or already transitioned)`,
    );
  }
}
