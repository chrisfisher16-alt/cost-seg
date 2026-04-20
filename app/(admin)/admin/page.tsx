import type { Route } from "next";
import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { Container } from "@/components/shared/Container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getPrisma } from "@/lib/db/client";
import { CATALOG, formatCents, type Tier } from "@/lib/stripe/catalog";
import { cn } from "@/lib/utils";
import type { StudyStatus } from "@prisma/client";

export const metadata = { title: "Admin · Pipeline" };

type Props = {
  searchParams: Promise<{ status?: string; tier?: string; q?: string }>;
};

const STATUSES: StudyStatus[] = [
  "PENDING_PAYMENT",
  "AWAITING_DOCUMENTS",
  "PROCESSING",
  "AI_COMPLETE",
  "AWAITING_ENGINEER",
  "ENGINEER_REVIEWED",
  "DELIVERED",
  "FAILED",
  "REFUNDED",
];

const TIERS: Tier[] = ["DIY", "AI_REPORT", "ENGINEER_REVIEWED"];

function isStatus(value: string | undefined): value is StudyStatus {
  return !!value && (STATUSES as string[]).includes(value);
}

function isTier(value: string | undefined): value is Tier {
  return !!value && (TIERS as string[]).includes(value);
}

async function loadRows(filter: {
  status: StudyStatus | null;
  tier: Tier | null;
  q: string | null;
}) {
  try {
    return await getPrisma().study.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.tier ? { tier: filter.tier } : {}),
        ...(filter.q
          ? {
              OR: [
                { user: { email: { contains: filter.q, mode: "insensitive" } } },
                { user: { name: { contains: filter.q, mode: "insensitive" } } },
                { property: { address: { contains: filter.q, mode: "insensitive" } } },
                { property: { city: { contains: filter.q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        tier: true,
        status: true,
        pricePaidCents: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { email: true, name: true } },
        property: { select: { city: true, state: true, address: true } },
      },
    });
  } catch {
    return [];
  }
}

async function loadCounts(): Promise<Record<StudyStatus, number>> {
  const zero = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<StudyStatus, number>;
  try {
    const rows = await getPrisma().study.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    for (const r of rows) zero[r.status] = r._count._all;
    return zero;
  } catch {
    return zero;
  }
}

function hoursSince(date: Date): string {
  const delta = (Date.now() - date.getTime()) / 1000;
  if (delta < 60) return `${Math.round(delta)}s`;
  if (delta < 3600) return `${Math.round(delta / 60)}m`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h`;
  return `${Math.round(delta / 86400)}d`;
}

export default async function AdminPipelinePage({ searchParams }: Props) {
  const params = await searchParams;
  const status = isStatus(params.status) ? params.status : null;
  const tier = isTier(params.tier) ? params.tier : null;
  const q = params.q?.trim() ? params.q.trim() : null;

  const [rows, counts] = await Promise.all([loadRows({ status, tier, q }), loadCounts()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  function buildHref(overrides: Partial<{ status: string; tier: string; q: string }>) {
    const next = new URLSearchParams();
    const eff = {
      status: "status" in overrides ? overrides.status : (status ?? undefined),
      tier: "tier" in overrides ? overrides.tier : (tier ?? undefined),
      q: "q" in overrides ? overrides.q : (q ?? undefined),
    };
    for (const [k, v] of Object.entries(eff)) {
      if (v) next.set(k, v);
    }
    const qs = next.toString();
    return (qs ? `/admin?${qs}` : "/admin") as Route;
  }

  return (
    <Container size="full" className="py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground mt-1 text-sm">Every study across every customer.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/engineer-queue">
            Engineer queue
            <Badge variant="muted" size="sm" className="ml-2">
              {counts.AWAITING_ENGINEER}
            </Badge>
          </Link>
        </Button>
      </header>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-5">
          <form method="get" action="/admin" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label
                htmlFor="admin-search"
                className="text-muted-foreground mb-1 block text-xs font-medium"
              >
                Search
              </label>
              <Input
                id="admin-search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Email, name, address, city"
                leadingAdornment={<SearchIcon className="h-4 w-4" />}
              />
            </div>
            {status ? <input type="hidden" name="status" value={status} /> : null}
            {tier ? <input type="hidden" name="tier" value={tier} /> : null}
            <Button type="submit" size="default">
              Search
            </Button>
            {q ? (
              <Button asChild variant="ghost" size="default">
                <Link href={buildHref({ q: undefined })}>Clear search</Link>
              </Button>
            ) : null}
          </form>

          <div className="flex flex-wrap items-start gap-6">
            <div className="space-y-1.5">
              <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  href={buildHref({ status: undefined })}
                  label="All"
                  count={total}
                  active={!status}
                />
                {STATUSES.map((s) => (
                  <FilterChip
                    key={s}
                    href={buildHref({ status: s })}
                    label={s.replace(/_/g, " ").toLowerCase()}
                    count={counts[s]}
                    active={status === s}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                Tier
              </p>
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  href={buildHref({ tier: undefined })}
                  label="All tiers"
                  count={null}
                  active={!tier}
                />
                {TIERS.map((t) => (
                  <FilterChip
                    key={t}
                    href={buildHref({ tier: t })}
                    label={CATALOG[t].label}
                    count={null}
                    active={tier === t}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 p-10 text-center">
            <p className="text-foreground text-sm font-medium">
              {status || tier || q ? "No studies match these filters." : "No studies yet."}
            </p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
              {status || tier || q
                ? "Try clearing filters or broadening your search — the first study might be waiting under a different status."
                : "Customer-submitted studies show up here in real time. As soon as one lands, you'll see it."}
            </p>
            {status || tier || q ? (
              <div className="flex justify-center pt-2">
                <Link
                  href="/admin"
                  className="text-primary hover:text-primary/80 text-sm font-medium underline-offset-4 hover:underline"
                >
                  Clear all filters
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-border bg-muted/40 text-muted-foreground border-b text-left text-xs tracking-wide uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-border/60 hover:bg-muted/40 border-b transition-colors",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/15",
                    )}
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`/admin/studies/${row.id}` as Route}
                        className="text-foreground font-medium hover:underline"
                      >
                        {row.user.email}
                      </Link>
                      {row.user.name ? (
                        <div className="text-muted-foreground text-xs">{row.user.name}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="truncate">{row.property.address}</div>
                      <div className="text-muted-foreground text-xs">
                        {row.property.city}, {row.property.state}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge
                        variant={row.tier === "ENGINEER_REVIEWED" ? "success" : "default"}
                        size="sm"
                      >
                        {CATALOG[row.tier].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <StatusBadge status={row.status} />
                    </td>
                    <td data-tabular className="px-4 py-3 text-right align-top">
                      {formatCents(row.pricePaidCents)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 align-top text-xs">
                      {hoursSince(row.updatedAt)} ago
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Container>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: Route;
  label: string;
  count: number | null;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted border",
      )}
    >
      <span>{label}</span>
      {count !== null ? (
        <span className={cn(active ? "opacity-70" : "text-muted-foreground")}>{count}</span>
      ) : null}
    </Link>
  );
}
