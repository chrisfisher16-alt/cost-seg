import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDownIcon, ChevronUpIcon, DownloadIcon, FileTextIcon, UserIcon } from "lucide-react";

import { AdminActionsPanel } from "@/components/admin/AdminActionsPanel";
import { JsonViewer } from "@/components/admin/JsonViewer";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DOCUMENT_KIND_META } from "@/components/intake/meta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/client";
import { PROPERTY_TYPE_LABELS } from "@/lib/estimator/types";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";
import { createSignedReadUrl } from "@/lib/storage/studies";
import { requireRole } from "@/lib/auth/require";
import { formatStudyEvent, type EventTone } from "@/lib/studies/event-format";
import { cn } from "@/lib/utils";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ expand?: string }>;
};

// Default + expanded caps. The expanded cap is still bounded so a study with
// thousands of events (e.g. one that's been re-run 20 times) can't blow up
// the admin's memory or the SSR render budget.
const DEFAULT_TAKE = 50;
const EXPANDED_TAKE = 500;

async function loadStudy(studyId: string, expanded: boolean) {
  const take = expanded ? EXPANDED_TAKE : DEFAULT_TAKE;
  try {
    const [study, totals] = await Promise.all([
      getPrisma().study.findUnique({
        where: { id: studyId },
        include: {
          user: { select: { id: true, email: true, name: true, role: true } },
          property: true,
          documents: { orderBy: { createdAt: "asc" } },
          events: { orderBy: { createdAt: "desc" }, take },
          aiAuditLogs: { orderBy: { createdAt: "desc" }, take },
        },
      }),
      // Count totals separately so the truncation hint is honest — we only
      // know we're over the cap if we compare against the real row count.
      getPrisma().study.findUnique({
        where: { id: studyId },
        select: { _count: { select: { events: true, aiAuditLogs: true } } },
      }),
    ]);
    if (!study || !totals) return null;
    return {
      study,
      totalEvents: totals._count.events,
      totalAuditLogs: totals._count.aiAuditLogs,
    };
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

/**
 * Shared small-caps section eyebrow so every block on this page uses the
 * same typography — matches the pattern on /admin and /admin/engineer-queue.
 */
function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-3 font-mono text-[11px] tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}

export default async function AdminStudyInspector({ params, searchParams }: Props) {
  await requireRole(["ADMIN"]);
  const { id } = await params;
  const { expand } = await searchParams;
  const expanded = expand === "1";
  const loaded = await loadStudy(id, expanded);
  if (!loaded) notFound();
  const { study, totalEvents, totalAuditLogs } = loaded;

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
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          &larr; Pipeline
        </Link>
      </nav>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{study.property.address}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {catalog.label} · {formatCents(study.pricePaidCents)} · Created{" "}
            {study.createdAt.toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-1 font-mono text-[10px] tracking-widest uppercase">
            Study {study.id}
          </p>
        </div>
        <StatusBadge status={study.status} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-8">
          <CustomerPropertyCard study={study} />

          <section>
            <SectionEyebrow>Documents ({documentsWithUrls.length})</SectionEyebrow>
            {documentsWithUrls.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="text-muted-foreground p-6 text-center text-sm">
                  No documents uploaded yet.
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-3">
                {documentsWithUrls.map((doc) => (
                  <li key={doc.id}>
                    <Card>
                      <CardContent className="p-4 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{doc.filename}</p>
                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                              <Badge variant="muted" size="sm">
                                {DOCUMENT_KIND_META[doc.kind]?.label ?? doc.kind}
                              </Badge>
                              <span>{(doc.sizeBytes / 1024).toFixed(0)} KB</span>
                              <span className="font-mono">{doc.mimeType}</span>
                            </div>
                          </div>
                          {doc.signedUrl ? (
                            <Button
                              asChild
                              size="sm"
                              variant="outline"
                              leadingIcon={<DownloadIcon />}
                            >
                              <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer">
                                Download
                              </a>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">Storage offline</span>
                          )}
                        </div>
                        {doc.extractedJson ? (
                          <div className="mt-3">
                            <JsonViewer label="Extracted fields" value={doc.extractedJson} />
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {decomposition ? (
            <section>
              <SectionEyebrow>Purchase-price decomposition</SectionEyebrow>
              <JsonViewer label="decomposition" value={decomposition} defaultOpen />
            </section>
          ) : null}

          {schedule?.lineItems?.length ? (
            <section>
              <SectionEyebrow>
                Asset schedule ({schedule.lineItems.length} line items)
              </SectionEyebrow>
              <JsonViewer label="schedule" value={schedule} />
            </section>
          ) : null}

          {narrative ? (
            <section>
              <SectionEyebrow>Narrative</SectionEyebrow>
              <div className="space-y-2">
                {Object.entries(narrative).map(([key, value]) => (
                  <Card key={key}>
                    <CardContent className="p-0">
                      <details className="text-sm">
                        <summary className="hover:bg-muted/40 cursor-pointer rounded-lg px-4 py-3 font-medium transition-colors">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </summary>
                        <p className="text-muted-foreground px-4 pb-4 whitespace-pre-wrap">
                          {value}
                        </p>
                      </details>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {deliverableSignedUrl ? (
            <section>
              <SectionEyebrow>Deliverable</SectionEyebrow>
              <Button asChild variant="outline" leadingIcon={<FileTextIcon />}>
                <a href={deliverableSignedUrl} target="_blank" rel="noopener noreferrer">
                  Download delivered PDF
                </a>
              </Button>
            </section>
          ) : null}

          <AiAuditTable
            logs={study.aiAuditLogs}
            totalCount={totalAuditLogs}
            expanded={expanded}
            studyId={study.id}
          />
          <EventTimeline
            events={study.events}
            totalCount={totalEvents}
            expanded={expanded}
            studyId={study.id}
          />
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
      <Card>
        <CardContent className="p-4 text-sm">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 text-primary mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <UserIcon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                Customer
              </p>
              <p className="mt-1.5 truncate font-medium">{study.user.email}</p>
              {study.user.name ? (
                <p className="text-muted-foreground text-xs">{study.user.name}</p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 text-sm">
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
            Property
          </p>
          <p className="mt-1.5 font-medium">{study.property.address}</p>
          <p className="text-muted-foreground text-xs">
            {study.property.city}, {study.property.state} {study.property.zip}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            {PROPERTY_TYPE_LABELS[study.property.propertyType]} · Acquired{" "}
            {study.property.acquiredAt.toLocaleDateString()}
          </p>
          <p className="text-muted-foreground text-xs">
            {price > 0 ? `$${price.toLocaleString("en-US")}` : "price TBD"}
            {study.property.squareFeet ? ` · ${study.property.squareFeet} sqft` : ""}
            {study.property.yearBuilt ? ` · built ${study.property.yearBuilt}` : ""}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

function AiAuditTable({
  logs,
  totalCount,
  expanded,
  studyId,
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
  totalCount: number;
  expanded: boolean;
  studyId: string;
}) {
  if (logs.length === 0) return null;
  // costUsd shown below is the sum of the rows we loaded, not the whole study.
  // When truncated, label it as "shown" so the admin doesn't misread it as
  // lifetime spend on this study.
  const shownCost = logs.reduce((a, l) => a + Number(l.costUsd), 0);
  const truncated = totalCount > logs.length;
  return (
    <section>
      <SectionEyebrow>
        AI audit trail ({logs.length}
        {truncated ? ` of ${totalCount}` : ""} calls, ${shownCost.toFixed(4)}
        {truncated ? " shown" : ""})
      </SectionEyebrow>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-border bg-muted/40 text-muted-foreground border-b text-left tracking-wide uppercase">
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
            <tbody className="divide-border/60 divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="text-muted-foreground px-3 py-2">
                    {log.createdAt.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-mono">{log.operation}</td>
                  <td className="px-3 py-2">{log.model}</td>
                  <td className="text-muted-foreground px-3 py-2 font-mono text-[10px]">
                    {log.promptVersion}
                  </td>
                  <td data-tabular className="px-3 py-2 text-right">
                    {log.tokensIn.toLocaleString()}
                  </td>
                  <td data-tabular className="px-3 py-2 text-right">
                    {log.tokensOut.toLocaleString()}
                  </td>
                  <td data-tabular className="px-3 py-2 text-right">
                    ${Number(log.costUsd).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <ExpandHint
        studyId={studyId}
        shown={logs.length}
        total={totalCount}
        expanded={expanded}
        label="calls"
      />
    </section>
  );
}

function EventTimeline({
  events,
  totalCount,
  expanded,
  studyId,
}: {
  events: Array<{
    id: string;
    kind: string;
    actorId: string | null;
    payload: unknown;
    createdAt: Date;
  }>;
  totalCount: number;
  expanded: boolean;
  studyId: string;
}) {
  if (events.length === 0) return null;
  const truncated = totalCount > events.length;
  return (
    <section>
      <SectionEyebrow>
        Event timeline ({events.length}
        {truncated ? ` of ${totalCount}` : ""})
      </SectionEyebrow>
      <ol className="space-y-2">
        {events.map((event) => {
          const formatted = formatStudyEvent(event.kind, event.payload);
          return (
            <li key={event.id}>
              <Card className={cn(toneBorder(formatted.tone))}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 rounded-full", toneDot(formatted.tone))} />
                        <p className="text-foreground text-sm font-medium">{formatted.title}</p>
                      </div>
                      {formatted.detail ? (
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {formatted.detail}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground font-mono text-[10px] tracking-wide">
                        {event.kind}
                        {event.actorId ? ` · actor ${event.actorId.slice(0, 8)}` : ""}
                      </p>
                    </div>
                    <time className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                      {event.createdAt.toLocaleString()}
                    </time>
                  </div>
                  <details className="mt-3">
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-[11px] select-none">
                      Raw payload
                    </summary>
                    <pre className="text-muted-foreground bg-muted/30 mt-2 overflow-auto rounded-md p-2 font-mono text-[10px] leading-snug">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>
      <ExpandHint
        studyId={studyId}
        shown={events.length}
        total={totalCount}
        expanded={expanded}
        label="events"
      />
    </section>
  );
}

/**
 * Shared "Show all" / "Collapse" affordance for the two truncation-prone
 * sections. When collapsed + over cap: shows the remaining count + a link
 * that toggles `?expand=1`. When expanded: shows the expanded cap + a link
 * back to the default view.
 *
 * We flow ?expand=1 through the URL instead of local state so the admin
 * can share the expanded view by copying the link.
 */
function ExpandHint({
  studyId,
  shown,
  total,
  expanded,
  label,
}: {
  studyId: string;
  shown: number;
  total: number;
  expanded: boolean;
  label: string;
}) {
  // Don't show anything when there's no truncation happening — collapsed
  // AND under the cap means the section is already showing everything.
  if (!expanded && total <= shown) return null;
  const href = (
    expanded ? `/admin/studies/${studyId}` : `/admin/studies/${studyId}?expand=1`
  ) as Route;
  const remaining = total - shown;
  return (
    <p className="text-muted-foreground mt-3 text-xs">
      {expanded ? (
        <>
          Showing all {shown} {label}.{" "}
          <Link
            href={href}
            className="text-foreground inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
          >
            Collapse <ChevronUpIcon className="h-3 w-3" aria-hidden />
          </Link>
        </>
      ) : (
        <>
          {remaining} older {label} hidden.{" "}
          <Link
            href={href}
            className="text-foreground inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
          >
            Show all <ChevronDownIcon className="h-3 w-3" aria-hidden />
          </Link>
        </>
      )}
    </p>
  );
}

function toneBorder(tone: EventTone): string {
  switch (tone) {
    case "success":
      return "border-success/30";
    case "primary":
      return "border-primary/30";
    case "warning":
      return "border-warning/30";
    case "destructive":
      return "border-destructive/30";
    default:
      return "";
  }
}

function toneDot(tone: EventTone): string {
  switch (tone) {
    case "success":
      return "bg-success";
    case "primary":
      return "bg-primary";
    case "warning":
      return "bg-warning";
    case "destructive":
      return "bg-destructive";
    case "muted":
      return "bg-muted-foreground/40";
    default:
      return "bg-foreground/30";
  }
}
