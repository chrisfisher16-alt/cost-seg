import Link from "next/link";
import { notFound } from "next/navigation";

import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";

type Props = {
  params: Promise<{ id: string }>;
};

async function loadStudy(studyId: string) {
  try {
    return await getPrisma().study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        userId: true,
        tier: true,
        status: true,
        pricePaidCents: true,
        createdAt: true,
        property: {
          select: { address: true, propertyType: true },
        },
      },
    });
  } catch {
    return null;
  }
}

export const metadata = { title: "Upload documents" };

export default async function StudyIntakePage({ params }: Props) {
  const { id } = await params;
  const { user } = await requireAuth(`/studies/${id}/intake`);

  const study = await loadStudy(id);
  if (!study) notFound();

  assertOwnership(user, { userId: study.userId });

  const entry = CATALOG[study.tier];

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <Link href="/dashboard" className="hover:text-foreground text-xs text-zinc-500">
          &larr; Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Upload your documents</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {entry.label} &middot; {formatCents(study.pricePaidCents)} paid &middot; Started{" "}
          {study.createdAt.toLocaleDateString()}
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/40 p-10 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
        <p className="font-medium">Upload UI ships in Phase 4.</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
          We&rsquo;ll ask for your closing disclosure, improvement receipts, and a few property
          photos. Until the uploader lands, your study waits in status{" "}
          <code className="rounded bg-zinc-100 px-1 font-mono text-xs dark:bg-zinc-900">
            {study.status}
          </code>
          .
        </p>
      </div>
    </main>
  );
}
