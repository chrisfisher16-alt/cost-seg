import * as React from "react";

import { Badge } from "@/components/ui/badge";

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

const MAP: Record<
  string,
  { label: string; variant: Parameters<typeof Badge>[0]["variant"]; dot?: boolean }
> = {
  PENDING_PAYMENT: { label: "Awaiting payment", variant: "warning", dot: true },
  AWAITING_DOCUMENTS: { label: "Upload needed", variant: "info", dot: true },
  PROCESSING: { label: "Processing", variant: "info", dot: true },
  AI_COMPLETE: { label: "AI complete", variant: "success", dot: true },
  AWAITING_ENGINEER: { label: "In engineer queue", variant: "warning", dot: true },
  ENGINEER_REVIEWED: { label: "Engineer reviewed", variant: "success", dot: true },
  DELIVERED: { label: "Delivered", variant: "success", dot: true },
  FAILED: { label: "Failed", variant: "destructive", dot: true },
  REFUNDED: { label: "Refunded", variant: "muted" },
};

export function StudyStatusBadge({
  status,
  size = "default",
}: {
  status: StudyStatus;
  size?: "default" | "sm";
}) {
  const entry = MAP[status] ?? {
    label: status.replace(/_/g, " ").toLowerCase(),
    variant: "muted" as const,
  };
  return (
    <Badge variant={entry.variant} size={size} dot={entry.dot}>
      {entry.label}
    </Badge>
  );
}
