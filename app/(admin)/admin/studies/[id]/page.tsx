import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminActionsPanel } from "@/components/admin/AdminActionsPanel";
import { JsonViewer } from "@/components/admin/JsonViewer";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getPrisma } from "@/lib/db/client";
import { PROPERTY_TYPE_LABELS } from "@/lib/estimator/types";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";
import { createSignedReadUrl } from "@/lib/storage/studies";
import { requireRole } from "@/lib/auth/require";

type Props = {
  params: Promise<{ id: string }>;
};

async function loadStudy(studyId: string) {
  try {
    return await getPrisma().study.findUnique({
      where: { id: studyId },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
        property: true,
        documents: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "desc" }, take: 50 },
        aiAuditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
  } catch {
    return null;
  }
}

async function tryCreateSignedUrl(path: string): Promise<string | null> {
  try {
    return await createSignedReadUrl(path, 60 * 60);
  } catch {
    return null;
  }
}

export const metadata = { title: "Admin · Study" };

export default async function AdminStudyInspector({ params }: Props) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const study = await loadStudy(id);
  if (!study) notFound();

  const catalog = CATALOG[study.tier];
  const scheduleBlob = study.assetSchedule as {
    decomposition?: Record<string, unknown>;
    schedule?: { lineItems?: unknown[]; assumptions?: string };
    narrative?: Record<string, unknown>;
    totalCents?: number;
  } | null;
  const decomposition = scheduleBlob?.decomposition;
  const schedule = scheduleBlob?.schedule;
  const narrative = scheduleBlob?.narrative as Record<string, string> | undefined;

  const documentsWithUrls = await Promise.all(
    study.documents.map(async (doc) => ({
      ...doc,
      signedUrl: await tryCreateSignedUrl(doc.storagePath),
    })),
  );
  const deliverableSignedUrl = study.deliverableUrl
    ? await tryCreateSignedUrl(study.deliverableUrl)
    : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="mb-4 text-xs">
        <Link href="/admin" className="hover:text-foreground text-zinc-500">
          &larr; Pipeline
        </Link>
      </nav>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{study.property.address}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {catalog.label} &middot; {formatCents(study.pricePaidCents)} &middot; Created{" "}
            {study.createdAt.toLocaleString()}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-widest text-zinc-500 uppercase">
            Study {study.id}
          </p>
        </div>
        <StatusBadge status={study.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          <CustomerPropertyCard study={study} />

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
              Documents ({documentsWithUrls.length})
            </h2>
            {documentsWithUrls.length === 0 ? (
              <p className="text-sm text-zinc-500">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-3">
                {documentsWithUrls.map((doc) => (
                  <li
                    key={doc.id}
                    className="rounded-xl border border-zinc-200/70 bg-white p-4 text-sm dark:border-zinc-800/70 dark:bg-zinc-950"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{doc.filename}</p>
                        <p className="text-xs text-zinc-500">
                          {doc.kind.replace(/_/g, " ").toLowerCase()} &middot;{" "}
                          {(doc.sizeBytes / 1024).toFixed(0)} KB &middot; {doc.mimeType}
                        </p>
                      </div>
                      {doc.signedUrl ? (
                        <a
                          href={doc.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs underline"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-zinc-500">Storage offline</span>
                      )}
                    </div>
                    {doc.extractedJson ? (
                      <div className="mt-3">
                        <JsonViewer label="Extracted fields" value={doc.extractedJson} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {decomposition ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                Purchase-price decomposition
              </h2>
              <JsonViewer label="decomposition" value={decomposition} defaultOpen />
            </section>
          ) : null}

          {schedule?.lineItems?.length ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                Asset schedule ({schedule.lineItems.length} line items)
              </h2>
              <JsonViewer label="schedule" value={schedule} />
            </section>
          ) : null}

          {narrative ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                Narrative
              </h2>
              {Object.entries(narrative).map(([key, value]) => (
                <details
                  key={key}
                  className="mb-2 rounded-md border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <summary className="cursor-pointer font-medium">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </summary>
                  <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {value}
                  </p>
                </details>
              ))}
            </section>
          ) : null}

          {deliverableSignedUrl ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
                Deliverable
              </h2>
              <a
                href={deliverableSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Download delivered PDF
              </a>
            </section>
          ) : null}

          <AiAuditTable logs={study.aiAuditLogs} />
          <EventTimeline events={study.events} />
        </div>

        <AdminActionsPanel
          studyId={study.id}
          status={study.status}
          tier={study.tier}
          deliverableUrl={study.deliverableUrl}
        />
      </div>
    </div>
  );
}

function CustomerPropertyCard({
  study,
}: {
  study: {
    user: { email: string; name: string | null };
    property: {
      address: string;
      city: string;
      state: string;
      zip: string;
      propertyType: keyof typeof PROPERTY_TYPE_LABELS;
      purchasePrice: unknown;
      acquiredAt: Date;
      squareFeet: number | null;
      yearBuilt: number | null;
    };
  };
}) {
  const price = Number(study.property.purchasePrice);
  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-zinc-200/70 bg-white p-4 text-sm dark:border-zinc-800/70 dark:bg-zinc-950">
        <h3 className="mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Customer
        </h3>
        <p className="font-medium">{study.user.email}</p>
        {study.user.name ? <p className="text-xs text-zinc-500">{study.user.name}</p> : null}
      </div>
      <div className="rounded-xl border border-zinc-200/70 bg-white p-4 text-sm dark:border-zinc-800/70 dark:bg-zinc-950">
        <h3 className="mb-2 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Property
        </h3>
        <p className="font-medium">{study.property.address}</p>
        <p className="text-xs text-zinc-500">
          {study.property.city}, {study.property.state} {study.property.zip}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          {PROPERTY_TYPE_LABELS[study.property.propertyType]} &middot; Acquired{" "}
          {study.property.acquiredAt.toLocaleDateString()}
        </p>
        <p className="text-xs text-zinc-500">
          {price > 0 ? `$${price.toLocaleString("en-US")}` : "price TBD"}
          {study.property.squareFeet ? ` · ${study.property.squareFeet} sqft` : ""}
          {study.property.yearBuilt ? ` · built ${study.property.yearBuilt}` : ""}
        </p>
      </div>
    </section>
  );
}

function AiAuditTable({
  logs,
}: {
  logs: Array<{
    id: string;
    operation: string;
    model: string;
    promptVersion: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: unknown;
    createdAt: Date;
  }>;
}) {
  if (logs.length === 0) return null;
  const totalCost = logs.reduce((a, l) => a + Number(l.costUsd), 0);
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
        AI audit trail ({logs.length} calls, ${totalCost.toFixed(4)})
      </h2>
      <div className="overflow-x-auto rounded-xl border border-zinc-200/70 dark:border-zinc-800/70">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50/80 text-left tracking-wide text-zinc-500 uppercase dark:bg-zinc-950/60">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Operation</th>
              <th className="px-3 py-2 font-medium">Model</th>
              <th className="px-3 py-2 font-medium">Prompt</th>
              <th className="px-3 py-2 text-right font-medium">In</th>
              <th className="px-3 py-2 text-right font-medium">Out</th>
              <th className="px-3 py-2 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/70 dark:divide-zinc-800/70">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-3 py-2 text-zinc-500">{log.createdAt.toLocaleString()}</td>
                <td className="px-3 py-2 font-mono">{log.operation}</td>
                <td className="px-3 py-2">{log.model}</td>
                <td className="px-3 py-2 font-mono text-[10px]">{log.promptVersion}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {log.tokensIn.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {log.tokensOut.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  ${Number(log.costUsd).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EventTimeline({
  events,
}: {
  events: Array<{
    id: string;
    kind: string;
    actorId: string | null;
    payload: unknown;
    createdAt: Date;
  }>;
}) {
  if (events.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-widest text-zinc-500 uppercase">
        Event timeline
      </h2>
      <ol className="space-y-2 text-xs">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono">{event.kind}</span>
              <span className="text-zinc-500">{event.createdAt.toLocaleString()}</span>
            </div>
            {event.actorId ? (
              <p className="mt-1 text-[10px] text-zinc-500">actor {event.actorId.slice(0, 8)}</p>
            ) : null}
            <pre className="mt-2 overflow-auto font-mono text-[10px] leading-snug text-zinc-600 dark:text-zinc-400">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </li>
        ))}
      </ol>
    </section>
  );
}
