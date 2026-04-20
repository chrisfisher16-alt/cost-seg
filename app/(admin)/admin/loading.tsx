import { Container } from "@/components/shared/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the admin pipeline (/admin). */
export default function AdminPipelineLoading() {
  return (
    <Container size="full" className="py-10">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-3">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-44" />
      </div>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="divide-border divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
