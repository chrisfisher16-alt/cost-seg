import type { Route } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { getPrisma } from "@/lib/db/client";
import { formatCents } from "@/lib/stripe/catalog";
import type { StudyStatus } from "@prisma/client";

export const metadata = { title: "Admin · Pipeline" };

type Props = {
  searchParams: Promise<{ status?: string }>;
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

function isStatus(value: string | undefined): value is StudyStatus {
  return !!value && (STATUSES as string[]).includes(value);
}

async function loadRows(filter: StudyStatus | null) {
  try {
    return await getPrisma().study.findMany({
      where: filter ? { status: filter } : undefined,
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
  const filter = isStatus(params.status) ? params.status : null;
  const [rows, counts] = await Promise.all([loadRows(filter), loadCounts()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Every study, across all customers.
          </p>
        </div>
        <Link
          href="/admin/engineer-queue"
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Engineer queue ({counts.AWAITING_ENGINEER})
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <FilterChip href="/admin" label="All" count={total} active={!filter} />
        {STATUSES.map((s) => (
          <FilterChip
            key={s}
            href={{ pathname: "/admin", query: { status: s } }}
            label={s.replace(/_/g, " ").toLowerCase()}
            count={counts[s]}
            active={filter === s}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          No studies match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200/70 dark:border-zinc-800/70">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50/80 text-left text-xs tracking-wide text-zinc-500 uppercase dark:bg-zinc-950/60">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-950/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/studies/${row.id}` as Route}
                      className="font-medium hover:underline"
                    >
                      {row.user.email}
                    </Link>
                    {row.user.name ? (
                      <div className="text-xs text-zinc-500">{row.user.name}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate">{row.property.address}</div>
                    <div className="text-xs text-zinc-500">
                      {row.property.city}, {row.property.state}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.tier === "AI_REPORT" ? "AI Report" : "Engineer-Reviewed"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(row.pricePaidCents)}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{hoursSince(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string | { pathname: string; query: Record<string, string> };
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href as Route}
      className={
        active
          ? "bg-foreground text-background inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
          : "inline-flex items-center gap-2 rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      }
    >
      <span>{label}</span>
      <span className={active ? "text-background/70" : "text-zinc-500 dark:text-zinc-500"}>
        {count}
      </span>
    </Link>
  );
}
