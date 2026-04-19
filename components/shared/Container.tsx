import * as React from "react";
import { cn } from "@/lib/utils";

type ContainerSize = "sm" | "md" | "lg" | "xl" | "full";

const sizeClasses: Record<ContainerSize, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
  full: "max-w-7xl",
};

export function Container({
  size = "xl",
  className,
  children,
  ...props
}: {
  size?: ContainerSize;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto w-full px-6 sm:px-8", sizeClasses[size], className)} {...props}>
      {children}
    </div>
  );
}
