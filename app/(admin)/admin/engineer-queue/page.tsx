import type { Route } from "next";
import type { PropertyType } from "@prisma/client";
import Link from "next/link";
import { ArrowRightIcon, ClockIcon } from "lucide-react";

import { EngineerQueueList } from "@/components/admin/EngineerQueueList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { formatCents } from "@/lib/stripe/catalog";
import { formatAgeSla, hoursBetween } from "@/lib/studies/admin-age";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Engineer queue" };

const FRESH_CUTOFF_HOURS = 72; // <3d = fresh (green)
const AGING_CUTOFF_HOURS = 120; // 3-5d = aging (amber). >5d = overdue (red).

type AgeBucket = "fresh" | "aging" | "overdue";

type Filter = "all" | AgeBucket;

type QueueRow = {
  id: string;
  pricePaidCents: number;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string; name: string | null };
  property: {
    address: string;
    city: string;
    state: string;
    propertyType: PropertyType;
  };
};

/**
 * Upper bound on rows the queue will render. Keeps the page from pulling
 * the whole table if the backlog ever grows past this — also keeps the
 * paired client select-all from tempting an admin with a checkbox tree
 * they can't actually submit (the server bulk cap is 50). A future
 * paginated view can relax this, but until then, 200 covers ~4 batches of
 * the current bulk-cap and still renders in a reasonable payload.
 */
const QUEUE_FETCH_CAP = 200;

async function loadQueue(): Promise<QueueRow[]> {
  try {
    return await getPrisma().study.findMany({
      where: { status: "AWAITING_ENGINEER" },
      orderBy: { updatedAt: "asc" },
      take: QUEUE_FETCH_CAP,
      select: {
        id: true,
        pricePaidCents: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { email: true, name: true } },
        property: {
          select: {
            address: true,
            city: true,
            state: true,
            propertyType: true,
          },
        },
      },
    });
  } catch {
    return [];
  }
}

// hoursBetween + formatAgeSla live in lib/studies/admin-age.ts so the two
// admin surfaces share the implementation. bucketAge stays local because
// FRESH_CUTOFF_HOURS / AGING_CUTOFF_HOURS are queue-specific SLA constants.
function bucketAge(hours: number): AgeBucket {
  if (hours < FRESH_CUTOFF_HOURS) return "fresh";
  if (hours < AGING_CUTOFF_HOURS) return "aging";
  return "overdue";
}

const PROPERTY_TYPE_SHORT: Record<PropertyType, string> = {
  SINGLE_FAMILY_RENTAL: "Single-family rental",
  SHORT_TERM_RENTAL: "STR",
  SMALL_MULTIFAMILY: "Small multifamily",
  MID_MULTIFAMILY: "Mid multifamily",
  COMMERCIAL: "Commercial",
};

function isFilter(value: string | undefined): value is Filter {
  return value === "all" || value === "fresh" || value === "aging" || value === "overdue";
}

type Props = {
  searchParams: Promise<{ bucket?: string }>;
};

export default async function AdminEngineerQueuePage({ searchParams }: Props) {
  await requireRole(["ADMIN"]);
  const params = await searchParams;
  const activeFilter: Filter = isFilter(params.bucket) ? params.bucket : "all";

  const rows = await loadQueue();
  // Server Component: rendered per-request, so Date.now() is pinned to the
  // request timestamp. Safe even though the react-hooks/purity rule flags
  // it — this function never runs on the client.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const withAge = rows.map((row) => {
    const updatedMs = row.updatedAt.getTime();
    const hours = hoursBetween(updatedMs, now);
    return {
      ...row,
      hours,
      bucket: bucketAge(hours),
      // Precompute the "3.2d" label here so QueueRowCard stays purely
      // presentational and the formatter is called once per row with the
      // request-pinned `now`.
      ageLabel: formatAgeSla(updatedMs, now),
    };
  });

  const counts = {
    all: withAge.length,
    fresh: withAge.filter((r) => r.bucket === "fresh").length,
    aging: withAge.filter((r) => r.bucket === "aging").length,
    overdue: withAge.filter((r) => r.bucket === "overdue").length,
  };

  const visible =
    activeFilter === "all" ? withAge : withAge.filter((r) => r.bucket === activeFilter);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-4 text-xs">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          &larr; Pipeline
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Engineer queue</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Tier 2 studies waiting for a PE review. Promise is 3–7 business days; studies that tip
            past 3 days turn amber, past 5 days turn red.
          </p>
        </div>
        {counts.overdue > 0 ? (
          <Badge variant="destructive" size="default">
            {counts.overdue} overdue
          </Badge>
        ) : counts.aging > 0 ? (
          <Badge variant="warning" size="default">
            {counts.aging} aging
          </Badge>
        ) : counts.all > 0 ? (
          <Badge variant="success" size="default">
            All fresh
          </Badge>
        ) : null}
      </header>

      {/* Filter chips */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        <FilterChip
          href="/admin/engineer-queue"
          label="All"
          count={counts.all}
          active={activeFilter === "all"}
        />
        <FilterChip
          href="/admin/engineer-queue?bucket=fresh"
          label="Fresh"
          count={counts.fresh}
          active={activeFilter === "fresh"}
          tone="success"
        />
        <FilterChip
          href="/admin/engineer-queue?bucket=aging"
          label="Aging"
          count={counts.aging}
          active={activeFilter === "aging"}
          tone="warning"
        />
        <FilterChip
          href="/admin/engineer-queue?bucket=overdue"
          label="Overdue"
          count={counts.overdue}
          active={activeFilter === "overdue"}
          tone="destructive"
        />
      </div>

      {visible.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-2 p-10 text-center">
            <p className="text-foreground text-sm font-medium">
              {activeFilter === "all" ? "Queue is empty." : `No ${activeFilter} studies right now.`}
            </p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
              {activeFilter === "all"
                ? "Engineer-Reviewed studies land here after their AI pipeline completes. When a customer upgrades or pays for Tier 2, they'll appear for PE signature."
                : "Try a different filter or head back to All."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <EngineerQueueList
          items={visible.map((row) => ({
            id: row.id,
            label: `${row.property.address} · ${row.property.city}, ${row.property.state}`,
            node: <QueueRowCard row={row} />,
          }))}
        />
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
  tone,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClasses =
    active && tone === "success"
      ? "bg-success text-success-foreground"
      : active && tone === "warning"
        ? "bg-warning text-warning-foreground"
        : active && tone === "destructive"
          ? "bg-destructive text-destructive-foreground"
          : active
            ? "bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted border";
  return (
    <Link
      href={href as Route}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        toneClasses,
      )}
    >
      <span>{label}</span>
      <span className={cn(active ? "opacity-70" : "text-muted-foreground")}>{count}</span>
    </Link>
  );
}

function QueueRowCard({
  row,
}: {
  row: QueueRow & { hours: number; bucket: AgeBucket; ageLabel: string };
}) {
  const agePillTone =
    row.bucket === "overdue"
      ? "bg-destructive/10 text-destructive border-destructive/30"
      : row.bucket === "aging"
        ? "bg-warning/10 text-warning-foreground border-warning/30"
        : "bg-success/10 text-success border-success/30";
  const customerLabel = row.user.name?.trim() || row.user.email;
  // The wrapping <li> is now provided by EngineerQueueList so each row can
  // share a row with its selection checkbox. Rendering <li> here too would
  // nest list-items invalidly.
  return (
    <Card
      className={cn(
        "transition hover:shadow-md",
        row.bucket === "overdue" && "border-destructive/40",
        row.bucket === "aging" && "border-warning/40",
      )}
    >
      <CardContent className="flex flex-wrap items-start gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{row.property.address}</h2>
            <Badge variant="muted" size="sm">
              {PROPERTY_TYPE_SHORT[row.property.propertyType]}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {row.property.city}, {row.property.state}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Customer <span className="text-foreground font-medium">{customerLabel}</span> ·{" "}
            {formatCents(row.pricePaidCents)} · Created{" "}
            {row.createdAt.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium tracking-wider uppercase",
              agePillTone,
            )}
            data-tabular
          >
            <ClockIcon className="h-3 w-3" aria-hidden />
            Waiting {row.ageLabel}
          </span>
          <Button asChild size="sm" trailingIcon={<ArrowRightIcon />}>
            <Link href={`/admin/studies/${row.id}` as Route}>Open inspector</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
