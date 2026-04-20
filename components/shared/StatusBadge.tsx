import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/studies/status-label";

type StudyStatus =
  | "PENDING_PAYMENT"
  | "AWAITING_DOCUMENTS"
  | "PROCESSING"
  | "AI_COMPLETE"
  | "AWAITING_ENGINEER"
  | "ENGINEER_REVIEWED"
  | "DELIVERED"
  | "FAILED"
  | "REFUNDED"
  | string;

/**
 * Tone map per status. Human copy comes from lib/studies/status-label so
 * it's reused anywhere a status is rendered, not only in a Badge —
 * keeps the label consistent across admin pages, view page sidebars,
 * the PipelineLive panels, and the event timeline.
 */
const TONE: Record<string, { variant: Parameters<typeof Badge>[0]["variant"]; dot?: boolean }> = {
  PENDING_PAYMENT: { variant: "warning", dot: true },
  AWAITING_DOCUMENTS: { variant: "info", dot: true },
  PROCESSING: { variant: "info", dot: true },
  AI_COMPLETE: { variant: "success", dot: true },
  AWAITING_ENGINEER: { variant: "warning", dot: true },
  ENGINEER_REVIEWED: { variant: "success", dot: true },
  DELIVERED: { variant: "success", dot: true },
  FAILED: { variant: "destructive", dot: true },
  REFUNDED: { variant: "muted" },
};

export function StudyStatusBadge({
  status,
  size = "default",
}: {
  status: StudyStatus;
  size?: "default" | "sm";
}) {
  const tone = TONE[status] ?? { variant: "muted" as const };
  return (
    <Badge variant={tone.variant} size={size} dot={tone.dot}>
      {statusLabel(status)}
    </Badge>
  );
}
