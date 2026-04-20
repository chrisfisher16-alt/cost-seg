import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the engineer queue view. */
export default function EngineerQueueLoading() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Skeleton className="mb-4 h-3 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-2">
                <Skeleton className="h-5 w-72" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-9 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
