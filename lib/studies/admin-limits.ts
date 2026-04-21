/**
 * Shared limits for admin bulk actions. Constants only — pure module with no
 * runtime deps, so both `"use client"` components (that want to cap local
 * selection state) and `"use server"` actions (that enforce the cap
 * server-side) can import the same number.
 */

/**
 * Max number of studies that can be submitted in a single
 * `adminBulkMarkFailedAction` call. Chosen to keep the action under
 * serverless timeouts even if Prisma round-trips slow down; the action
 * rejects anything longer with a "do it in batches" error. The client
 * `EngineerQueueList` caps its select-all at this value so the admin never
 * picks >50 rows and then fails at submit.
 */
export const BULK_MARK_FAILED_CAP = 50;
