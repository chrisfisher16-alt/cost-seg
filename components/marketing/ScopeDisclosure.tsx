import { InfoIcon } from "lucide-react";

import { SCOPE_DISCLOSURE_SHORT } from "@/lib/pdf/disclosure-short";
import { cn } from "@/lib/utils";

export function ScopeDisclosure({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    // Same text as the full variant (single SSOT per B2-2). Compact differs
    // only in typography — no border, smaller text — so a tight page
    // footer doesn't fight for visual space with the primary CTA.
    return (
      <p className={cn("text-muted-foreground text-xs leading-relaxed", className)}>
        {SCOPE_DISCLOSURE_SHORT}
      </p>
    );
  }
  return (
    <div
      className={cn(
        "border-warning/40 bg-warning/10 flex gap-3 rounded-md border p-4 text-sm leading-relaxed",
        className,
      )}
    >
      <InfoIcon
        className="text-warning-foreground dark:text-warning mt-0.5 h-4 w-4 shrink-0"
        aria-hidden
      />
      <div className="text-warning-foreground dark:text-warning">
        <p className="font-semibold">Important scope disclosure.</p>
        <p className="mt-1 opacity-90">{SCOPE_DISCLOSURE_SHORT}</p>
      </div>
    </div>
  );
}
