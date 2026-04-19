import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "bg-card flex min-h-20 w-full rounded-md border px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-[border-color,box-shadow] duration-150",
        "focus-visible:border-primary focus-visible:ring-ring/40 outline-none focus-visible:ring-2",
        "resize-y",
        invalid
          ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
          : "border-input",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
