import * as React from "react";

import { cn } from "@/lib/utils";

export function Kbd({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "border-border bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded border px-1 font-mono text-[10px] font-medium",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
