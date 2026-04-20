import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the admin study detail view. */
export default function AdminStudyLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Skeleton className="mb-4 h-3 w-24" />
      <div className="space-y-3">
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
