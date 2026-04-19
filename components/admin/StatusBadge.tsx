import type { StudyStatus } from "@prisma/client";

import { StudyStatusBadge } from "@/components/shared/StatusBadge";

/**
 * Thin admin re-export — the admin panel historically used this symbol, and we
 * keep it here so admin pages that import from `@/components/admin/StatusBadge`
 * continue to compile. The canonical badge lives in `components/shared`.
 */
export function StatusBadge({ status }: { status: StudyStatus }) {
  return <StudyStatusBadge status={status} />;
}
