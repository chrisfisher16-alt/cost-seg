import type { StudyStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

const TONE: Record<StudyStatus, string> = {
  PENDING_PAYMENT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  AWAITING_DOCUMENTS: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200",
  PROCESSING: "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-200",
  AI_COMPLETE: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200",
  AWAITING_ENGINEER: "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
  ENGINEER_REVIEWED: "bg-teal-100 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200",
  DELIVERED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  FAILED: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200",
  REFUNDED: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: StudyStatus }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-widest uppercase",
        TONE[status],
      )}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
