import { Container } from "@/components/shared/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for /dashboard. Mirrors the page's actual shape — page header,
 * 3 stat cards, portfolio strip, study list — so the layout stays stable
 * during the first server roundtrip and users don't see cumulative layout
 * shift when content streams in.
 */
export default function DashboardLoading() {
  return (
    <Container size="xl" className="py-10">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Stat row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Study list */}
      <div className="mt-10 space-y-3">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </Container>
  );
}
