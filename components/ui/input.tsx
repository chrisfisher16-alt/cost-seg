import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingAdornment?: React.ReactNode;
  trailingAdornment?: React.ReactNode;
  invalid?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leadingAdornment, trailingAdornment, invalid, ...props }, ref) => {
    const inputClasses = cn(
      "flex h-10 w-full rounded-md border bg-card px-3 py-2 text-sm",
      "placeholder:text-muted-foreground",
      "file:border-0 file:bg-transparent file:text-sm file:font-medium",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "transition-[border-color,box-shadow] duration-150",
      "outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40",
      invalid
        ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30"
        : "border-input",
      leadingAdornment && "pl-9",
      trailingAdornment && "pr-9",
      className,
    );

    if (leadingAdornment || trailingAdornment) {
      return (
        <div className="relative">
          {leadingAdornment ? (
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-sm">
              {leadingAdornment}
            </span>
          ) : null}
          <input type={type} className={inputClasses} ref={ref} {...props} />
          {trailingAdornment ? (
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex w-9 items-center justify-center text-sm">
              {trailingAdornment}
            </span>
          ) : null}
        </div>
      );
    }

    return <input type={type} className={inputClasses} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

export { Input };
