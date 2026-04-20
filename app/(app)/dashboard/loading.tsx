import { Container } from "@/components/shared/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for /dashboard. Mirrors the real page shape so the layout stays
 * stable during the first server roundtrip — no cumulative layout shift when
 * real content swaps in.
 *
 * Intentionally omits the conditional portfolio-strip block (shown only when
 * >=1 delivered study exists) — guessing it into the skeleton would cause its
 * own CLS for the majority case. Dimensions match:
 *   - PageHeader h1 text-3xl → h-8 skeleton
 *   - StatCard (label eyebrow + tabular 3xl number) → 2 rows
 *   - StudyCard (icon tile + address + 3-badge row + hint + 2 actions)
 *     post-Day 19 enrichment.
 */
export default function DashboardLoading() {
  return (
    <Container size="xl" className="py-10 sm:py-14">
      {/* PageHeader: title + description + actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-60 sm:w-72" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-32" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>

      {/* Stat row — 3 cards, eyebrow + big tabular number. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* "Your studies" section header */}
      <div className="mt-10 space-y-4">
        <Skeleton className="h-3 w-28" />

        {/* StudyCard shape (post-Day 19): icon tile · address + 3-badge row
           + next-action hint line · two right-side buttons. */}
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-4 p-5">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-72 max-w-full" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-5 w-24 rounded-full" />
                      <Skeleton className="h-5 w-28 rounded-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-3 w-56 max-w-full" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}
