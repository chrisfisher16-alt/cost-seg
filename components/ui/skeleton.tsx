import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("shimmer bg-muted/60 rounded-md", className)} {...props} />;
}

export { Skeleton };
