import { Container } from "@/components/shared/Container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for the read-only study view. Mirrors the delivered-study
 * shape — PageHeader, headline KPI card, per-class breakdown row (Day 32),
 * asset-schedule table, and the sidebar property card with the icon tile.
 * Grid template matches the real page's `lg:grid-cols-[1fr_320px]` so the
 * column widths don't shift when content streams in.
 */
export default function StudyViewLoading() {
  return (
    <Container size="xl" className="py-10 sm:py-14">
      {/* PageHeader: back link, title, description, meta row, action button */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-96 max-w-full" />
            <Skeleton className="h-4 w-64" />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Headline KPI card + per-class breakdown */}
      <div className="mt-8 space-y-4">
        <Card>
          <CardContent className="p-7">
            <div className="grid gap-6 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-9 w-36" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-border bg-card rounded-md border p-4">
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="mt-2 h-6 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Schedule + sidebar. Grid matches real page [1fr_320px]. */}
      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* SectionHeader: eyebrow + title + description */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          {/* Asset-schedule table */}
          <Card>
            <CardContent className="space-y-3 p-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Property-details sidebar — icon tile + dl rows + owner line */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
