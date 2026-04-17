import { getPrisma } from "@/lib/db/client";
import type { StudyStatus } from "@prisma/client";

export const metadata = { title: "Admin" };

const STATUS_COLUMNS: { status: StudyStatus; label: string }[] = [
  { status: "PENDING_PAYMENT", label: "Pending payment" },
  { status: "AWAITING_DOCUMENTS", label: "Awaiting docs" },
  { status: "PROCESSING", label: "Processing" },
  { status: "AI_COMPLETE", label: "AI complete" },
  { status: "AWAITING_ENGINEER", label: "Awaiting engineer" },
  { status: "ENGINEER_REVIEWED", label: "Engineer reviewed" },
  { status: "DELIVERED", label: "Delivered" },
  { status: "FAILED", label: "Failed" },
  { status: "REFUNDED", label: "Refunded" },
];

async function loadCounts(): Promise<Record<StudyStatus, number>> {
  const empty = Object.fromEntries(STATUS_COLUMNS.map((c) => [c.status, 0])) as Record<
    StudyStatus,
    number
  >;
  try {
    const rows = await getPrisma().study.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    for (const row of rows) {
      empty[row.status] = row._count._all;
    }
  } catch {
    // Dev without DATABASE_URL — render zero counts.
  }
  return empty;
}

export default async function AdminPipelinePage() {
  const counts = await loadCounts();
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every study, by stage. Per-study inspector lands in Phase 7.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STATUS_COLUMNS.map((col) => (
          <article
            key={col.status}
            className="rounded-xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950"
          >
            <p className="font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
              {col.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{counts[col.status]}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
