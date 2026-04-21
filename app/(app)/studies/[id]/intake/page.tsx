import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangleIcon,
  EyeIcon,
  FileIcon,
  HelpCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { IntakeProgress } from "@/components/intake/IntakeProgress";
import { IntakeStartButton } from "@/components/intake/IntakeStartButton";
import { PropertyForm } from "@/components/intake/PropertyForm";
import { UploadZone } from "@/components/intake/UploadZone";
import { DOCUMENT_KIND_META, DOCUMENT_KIND_ORDER } from "@/components/intake/meta";
import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { BRAND } from "@/lib/brand";
import { getPrisma } from "@/lib/db/client";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";
import { computeNextAction } from "@/lib/studies/next-action";
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
        updatedAt: true,
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

  // Server Component: eslint disables purity because Date.now() here is
  // pinned to the request timestamp, same pattern used on the dashboard.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const nextAction = computeNextAction({
    status: study.status,
    tier: study.tier,
    updatedAtMs: study.updatedAt.getTime(),
    nowMs,
    missingRequiredDocs: completeness.missingKinds.length,
  });
  // Stuck = AWAITING_DOCUMENTS for ≥72h. Dashboard StudyCards already show
  // this; the intake page itself didn't — so a user who opened their old
  // welcome email landed on intake without any signal that their study has
  // been sitting. Warning tone banner replaces the "close this tab" copy
  // in the stuck case.
  const showStuckWarning = !locked && !processing && nextAction.tone === "warning";

  const docsByKind = new Map<DocumentKind, typeof study.documents>();
  for (const d of study.documents) {
    const bucket = docsByKind.get(d.kind) ?? [];
    bucket.push(d);
    docsByKind.set(d.kind, bucket);
  }

  const rawAddress = study.property.address.startsWith("(provided") ? "" : study.property.address;
  const processingHref = `/studies/${study.id}/processing` as Route;

  return (
    <Container size="xl" className="py-10 sm:py-14">
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title={`Intake for your ${entry.label}`}
        meta={
          <>
            <Badge variant={study.tier === "ENGINEER_REVIEWED" ? "success" : "default"} size="sm">
              {entry.label}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {formatCents(study.pricePaidCents)} paid · Started{" "}
              {study.createdAt.toLocaleDateString()}
            </span>
          </>
        }
        actions={
          processing ? (
            <Button asChild leadingIcon={<EyeIcon />}>
              <Link href={processingHref}>Watch the pipeline</Link>
            </Button>
          ) : null
        }
      />

      {showStuckWarning ? (
        <div className="border-warning/40 bg-warning/5 text-foreground mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <AlertTriangleIcon className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">This study has been waiting on you.</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {nextAction.hint} If you&rsquo;re blocked on a document, reply to your welcome email
              or ping{" "}
              <a
                href={`mailto:${BRAND.email.support}`}
                className="text-foreground underline-offset-2 hover:underline"
              >
                {BRAND.email.support}
              </a>{" "}
              and we&rsquo;ll help.
            </p>
          </div>
        </div>
      ) : !locked && !processing ? (
        <div className="border-primary/30 bg-primary/5 text-foreground mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm">
          <ShieldCheckIcon className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">You can close this tab at any time.</p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Each upload saves automatically. Once you&rsquo;ve added every document you want
              included, click <span className="font-semibold">Start my report</span> in the sidebar
              — we&rsquo;ll email you the moment the PDF is ready.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Property details</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Everything we couldn&rsquo;t capture at checkout. You can save and come back to
                finish these any time.
              </p>
            </div>
            <Card>
              <CardContent className="p-7">
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
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Documents</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Private to you and the engineer reviewing your study. Encrypted at rest.
              </p>
            </div>
            <ul className="space-y-5">
              {DOCUMENT_KIND_ORDER.map((kind) => {
                const meta = DOCUMENT_KIND_META[kind];
                const uploaded = (docsByKind.get(kind) ?? []).map((d) => ({
                  id: d.id,
                  filename: d.filename,
                  sizeBytes: d.sizeBytes,
                  mimeType: d.mimeType,
                }));
                return (
                  <li key={kind}>
                    <Card>
                      <CardContent className="p-6">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="bg-primary/10 text-primary inline-flex h-9 w-9 items-center justify-center rounded-md">
                              <FileIcon className="h-4 w-4" aria-hidden />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{meta.label}</p>
                                {meta.required ? (
                                  <Badge variant="warning" size="sm">
                                    Required
                                  </Badge>
                                ) : (
                                  <Badge variant="muted" size="sm">
                                    Optional
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                                {meta.description}
                              </p>
                            </div>
                          </div>
                          {uploaded.length > 0 ? (
                            <Badge variant="success" size="sm" dot>
                              {uploaded.length} file{uploaded.length === 1 ? "" : "s"}
                            </Badge>
                          ) : null}
                        </div>
                        <UploadZone
                          studyId={study.id}
                          kind={kind}
                          uploaded={uploaded}
                          locked={locked}
                        />
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <IntakeProgress
            propertyReady={completeness.propertyReady}
            missingKinds={completeness.missingKinds}
            complete={completeness.complete}
            processing={processing}
            startSlot={
              completeness.complete && !processing && !locked ? (
                <IntakeStartButton studyId={study.id} />
              ) : null
            }
          />
          <Card className="bg-muted/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <ShieldCheckIcon className="h-4 w-4" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm leading-tight font-medium">Privacy by default</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Documents are stored encrypted in a private bucket. Only you and your assigned
                    engineer can generate signed links to access them.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <HelpCircleIcon className="h-4 w-4" aria-hidden />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm leading-tight font-medium">Stuck on a document?</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Email{" "}
                    <a href={`mailto:${BRAND.email.support}`} className="font-mono">
                      {BRAND.email.support}
                    </a>{" "}
                    and we&rsquo;ll help you find the right file from your closing packet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </Container>
  );
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
