/**
 * Dashboard list ordering.
 *
 * Before: `orderBy: { createdAt: "desc" }` on the Prisma query. A user
 * with 10 delivered studies and 1 AWAITING_DOCUMENTS study would see the
 * actionable one wherever `createdAt` put it — often buried below the
 * terminal-state ones if that awaiting-docs study was an older purchase
 * the user is just now getting around to.
 *
 * After: we sort client-side (the Prisma query still uses `createdAt desc`
 * as the stable base). Work-in-progress studies float to the top, grouped
 * by the kind of attention they need. Delivered studies come next. Terminal
 * failure states sink to the bottom.
 *
 * Pure. No DB. Intended to be called after `listStudies` returns.
 */

/**
 * Buckets in render order (lower index = higher on the list). Within a
 * bucket, ties are broken by `updatedAt desc` so the most-recently-touched
 * study in each group floats to the top of its group.
 *
 * AWAITING_DOCUMENTS and PENDING_PAYMENT are at priority 0 because they
 * need the *user's* action — surfacing them first is the point of the
 * whole sort.
 *
 * PROCESSING / AI_COMPLETE / AWAITING_ENGINEER / ENGINEER_REVIEWED are the
 * in-flight states — we're waiting on Inngest or an engineer, not the user.
 *
 * DELIVERED comes after — it's the happy terminal state and usually the
 * user just wants to find it to download again.
 *
 * FAILED and REFUNDED sink to the bottom — the admin has almost certainly
 * already reached out if there's anything to do.
 */
const STATUS_PRIORITY: Record<string, number> = {
  AWAITING_DOCUMENTS: 0,
  PENDING_PAYMENT: 0,
  PROCESSING: 1,
  AI_COMPLETE: 1,
  AWAITING_ENGINEER: 1,
  ENGINEER_REVIEWED: 1,
  DELIVERED: 2,
  FAILED: 3,
  REFUNDED: 4,
};

// Unknown statuses (forward-compat for schema additions) sort between
// delivered and failed — neutral enough to avoid surprise, but not so low
// that they vanish from view.
const UNKNOWN_PRIORITY = 2.5;

export interface DashboardSortable {
  status: string;
  updatedAt: Date;
}

export function sortStudiesByWorkPriority<T extends DashboardSortable>(studies: T[]): T[] {
  // Returns a new array; never mutates the input. Callers that memoize on
  // the source reference stay valid.
  return [...studies].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status] ?? UNKNOWN_PRIORITY;
    const pb = STATUS_PRIORITY[b.status] ?? UNKNOWN_PRIORITY;
    if (pa !== pb) return pa - pb;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}
