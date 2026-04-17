import Link from "next/link";

import { requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";

export const metadata = { title: "Dashboard" };

async function listStudies(userId: string) {
  try {
    return await getPrisma().study.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        tier: true,
        status: true,
        createdAt: true,
        property: { select: { address: true, city: true, state: true } },
      },
    });
  } catch {
    // Dev without DATABASE_URL — fall through to empty state.
    return [];
  }
}

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const studies = await listStudies(user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            All of your studies in one place.
          </p>
        </div>
        <Link
          href="/#pricing"
          className="bg-foreground text-background inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition hover:opacity-90"
        >
          Start a new study
        </Link>
      </div>

      {studies.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {studies.map((study) => (
            <StudyCard key={study.id} study={study} />
          ))}
        </ul>
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/40 p-10 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
      <p className="font-medium">No studies yet.</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        Pick a tier, upload your closing disclosure, and we&rsquo;ll have your first report in
        minutes.
      </p>
      <Link
        href="/#pricing"
        className="bg-foreground text-background mt-6 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition hover:opacity-90"
      >
        See pricing
      </Link>
    </div>
  );
}

type StudyCardProps = {
  study: {
    id: string;
    tier: "AI_REPORT" | "ENGINEER_REVIEWED";
    status: string;
    createdAt: Date;
    property: { address: string; city: string; state: string };
  };
};

function StudyCard({ study }: StudyCardProps) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200/70 bg-white p-4 text-sm dark:border-zinc-800/70 dark:bg-zinc-950">
      <div>
        <p className="font-medium">
          {study.property.address}, {study.property.city}, {study.property.state}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {study.tier === "AI_REPORT" ? "AI Report" : "Engineer-Reviewed"} · Started{" "}
          {study.createdAt.toLocaleDateString()}
        </p>
      </div>
      <StatusBadge status={study.status} />
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "DELIVERED"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
      : status === "FAILED" || status === "REFUNDED"
        ? "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] tracking-widest uppercase ${tone}`}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}
