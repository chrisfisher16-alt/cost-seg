import Link from "next/link";
import { notFound } from "next/navigation";

import { IntakeProgress } from "@/components/intake/IntakeProgress";
import { PropertyForm } from "@/components/intake/PropertyForm";
import { UploadZone } from "@/components/intake/UploadZone";
import { DOCUMENT_KIND_META, DOCUMENT_KIND_ORDER } from "@/components/intake/meta";
import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";
import { getIntakeCompleteness } from "@/lib/studies/ready-check";
import type { DocumentKind } from "@prisma/client";

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
          select: {
            address: true,
            city: true,
            state: true,
            zip: true,
            purchasePrice: true,
            acquiredAt: true,
            propertyType: true,
            squareFeet: true,
            yearBuilt: true,
          },
        },
        documents: {
          select: {
            id: true,
            kind: true,
            filename: true,
            sizeBytes: true,
            mimeType: true,
          },
          orderBy: { createdAt: "asc" },
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

  const completeness = await getIntakeCompleteness(study.id);
  const locked = study.status !== "AWAITING_DOCUMENTS";
  const entry = CATALOG[study.tier];
  const processing = study.status === "PROCESSING" || study.status === "AI_COMPLETE";

  const docsByKind = new Map<DocumentKind, typeof study.documents>();
  for (const d of study.documents) {
    const bucket = docsByKind.get(d.kind) ?? [];
    bucket.push(d);
    docsByKind.set(d.kind, bucket);
  }

  const rawAddress = study.property.address.startsWith("(provided") ? "" : study.property.address;

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <header>
        <Link href="/dashboard" className="hover:text-foreground text-xs text-zinc-500">
          &larr; Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Intake for your {entry.label}
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatCents(study.pricePaidCents)} paid &middot; Started{" "}
          {study.createdAt.toLocaleDateString()}
        </p>
      </header>

      <IntakeProgress
        propertyReady={completeness.propertyReady}
        missingKinds={completeness.missingKinds}
        complete={completeness.complete}
        processing={processing}
      />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Property details</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Everything we couldn&rsquo;t capture at checkout.
          </p>
        </div>
        <PropertyForm
          studyId={study.id}
          locked={locked}
          initial={{
            address: rawAddress,
            city: study.property.city,
            state: study.property.state === "XX" ? "" : study.property.state,
            zip: study.property.zip,
            purchasePriceDollars:
              Number(study.property.purchasePrice) > 0
                ? Number(study.property.purchasePrice).toString()
                : "",
            acquiredAt: toIsoDate(study.property.acquiredAt),
            propertyType: study.property.propertyType,
            squareFeet: study.property.squareFeet,
            yearBuilt: study.property.yearBuilt,
          }}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Private to you and the engineer reviewing your study.
          </p>
        </div>
        <ul className="space-y-6">
          {DOCUMENT_KIND_ORDER.map((kind) => {
            const meta = DOCUMENT_KIND_META[kind];
            const uploaded = (docsByKind.get(kind) ?? []).map((d) => ({
              id: d.id,
              filename: d.filename,
              sizeBytes: d.sizeBytes,
              mimeType: d.mimeType,
            }));
            return (
              <li
                key={kind}
                className="rounded-xl border border-zinc-200/70 bg-white p-5 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950"
              >
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {meta.label}
                      {meta.required ? (
                        <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] tracking-widest text-zinc-600 uppercase dark:bg-zinc-900 dark:text-zinc-400">
                          required
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {meta.description}
                    </p>
                  </div>
                </div>
                <UploadZone studyId={study.id} kind={kind} uploaded={uploaded} locked={locked} />
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
