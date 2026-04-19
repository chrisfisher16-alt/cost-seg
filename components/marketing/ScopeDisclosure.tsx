import { InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function ScopeDisclosure({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <p className={cn("text-muted-foreground text-xs leading-relaxed", className)}>
        This is a planning estimate — not a complete cost segregation study under IRS Pub 5653. Do
        not rely on it for a tax filing without CPA review.
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
        <p className="mt-1 opacity-90">
          This is a planning and modeling estimate produced by software. It is not a complete cost
          segregation study under the IRS Cost Segregation Audit Techniques Guide (Publication
          5653). Do not file a tax return relying on this number without your CPA&rsquo;s
          independent review.
        </p>
      </div>
    </div>
  );
}
