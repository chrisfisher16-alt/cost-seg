import { Container } from "@/components/shared/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton for the read-only study view. Mirrors the delivered-study shape. */
export default function StudyViewLoading() {
  return (
    <Container size="xl" className="py-10">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-96 max-w-full" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Year-1 KPI */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-4 w-56" />
            </CardContent>
          </Card>

          {/* Asset schedule table */}
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-5 w-40" />
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between gap-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-44" />
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  );
}
