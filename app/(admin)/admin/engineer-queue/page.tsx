import type { Route } from "next";
import Link from "next/link";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireRole } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { formatCents } from "@/lib/stripe/catalog";

export const metadata = { title: "Admin · Engineer queue" };

async function loadQueue() {
  try {
    return await getPrisma().study.findMany({
      where: { status: "AWAITING_ENGINEER" },
      orderBy: { updatedAt: "asc" },
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

function hoursSince(date: Date): string {
  const delta = (Date.now() - date.getTime()) / 1000;
  if (delta < 60) return `${Math.round(delta)}s`;
  if (delta < 3600) return `${Math.round(delta / 60)}m`;
  if (delta < 86400) return `${Math.round(delta / 3600)}h`;
  return `${Math.round(delta / 86400)}d`;
}

export default async function AdminEngineerQueuePage() {
  await requireRole(["ADMIN"]);
  const rows = await loadQueue();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <nav className="mb-4 text-xs">
        <Link href="/admin" className="hover:text-foreground text-zinc-500">
          &larr; Pipeline
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Engineer queue</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Tier 2 studies waiting for a PE review. Click a row to open the inspector and upload the
          signed PDF there.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Queue is empty.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-semibold">{row.property.address}</h2>
                    <StatusBadge status="AWAITING_ENGINEER" />
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {row.property.city}, {row.property.state}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Customer {row.user.email} &middot; {formatCents(row.pricePaidCents)} &middot;
                    Waiting {hoursSince(row.updatedAt)}
                  </p>
                </div>
                <Link
                  href={`/admin/studies/${row.id}` as Route}
                  className="bg-foreground text-background inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium transition hover:opacity-90"
                >
                  Open inspector
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
