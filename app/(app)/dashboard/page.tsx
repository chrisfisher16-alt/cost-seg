import type { Route } from "next";
import Link from "next/link";
import {
  DownloadIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  HomeIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";

import { downloadMyDeliverableAction } from "./actions";
import { Container } from "@/components/shared/Container";
import { Kpi } from "@/components/shared/Kpi";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StudyStatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import {
  buildPortfolioTotals,
  type PortfolioStudyInput,
  type PortfolioTotals,
} from "@/lib/studies/aggregate";
import { CATALOG, formatCents, type Tier } from "@/lib/stripe/catalog";
import { computeNextAction, formatRelativeAge } from "@/lib/studies/next-action";
import { listStudiesSharedWith } from "@/lib/studies/share";
import { cn } from "@/lib/utils";
import type { DocumentKind, StudyStatus } from "@prisma/client";

export const metadata = { title: "Dashboard" };

type StudyListItem = {
  id: string;
  tier: Tier;
  status: StudyStatus;
  createdAt: Date;
  updatedAt: Date;
  deliverableUrl: string | null;
  requiredDocsMissing: number;
  property: { address: string; city: string; state: string };
};

async function listStudies(userId: string): Promise<{
  listItems: StudyListItem[];
  aggregateInput: PortfolioStudyInput[];
}> {
  try {
    const rows = await getPrisma().study.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        tier: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deliveredAt: true,
        deliverableUrl: true,
        assetSchedule: true,
        documents: { select: { kind: true } },
        property: {
          select: {
            address: true,
            city: true,
            state: true,
            zip: true,
            propertyType: true,
            purchasePrice: true,
            acquiredAt: true,
          },
        },
      },
    });

    // Required document kinds for non-DIY tiers; DIY has no doc requirements.
    const requiredKinds: DocumentKind[] = ["CLOSING_DISCLOSURE", "PROPERTY_PHOTO"];

    return {
      listItems: rows.map((r) => {
        const uploadedKinds = new Set<DocumentKind>(r.documents.map((d) => d.kind));
        const missing =
          r.tier === "DIY" ? 0 : requiredKinds.filter((k) => !uploadedKinds.has(k)).length;
        return {
          id: r.id,
          tier: r.tier,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          deliverableUrl: r.deliverableUrl,
          requiredDocsMissing: missing,
          property: {
            address: r.property.address,
            city: r.property.city,
            state: r.property.state,
          },
        };
      }),
      aggregateInput: rows.map((r) => ({
        id: r.id,
        tier: r.tier,
        status: r.status,
        createdAt: r.createdAt,
        deliveredAt: r.deliveredAt,
        property: {
          address: r.property.address,
          city: r.property.city,
          state: r.property.state,
          zip: r.property.zip,
          propertyType: r.property.propertyType,
          purchasePriceCents: Math.round(Number(r.property.purchasePrice) * 100),
          acquiredAt: r.property.acquiredAt,
        },
        assetSchedule: (r.assetSchedule as PortfolioStudyInput["assetSchedule"]) ?? null,
      })),
    };
  } catch {
    return { listItems: [], aggregateInput: [] };
  }
}

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const [{ listItems: studies, aggregateInput }, sharedResult] = await Promise.all([
    listStudies(user.id),
    safeListShared(user.id),
  ]);
  const sharedStudies = sharedResult.ok ? sharedResult.shares : [];
  const sharedError = sharedResult.ok ? null : sharedResult.error;
  // Pinned to the request timestamp in the server component; pass to cards
  // so each one's relative-age + stuck-state math lines up.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const delivered = studies.filter((s) => s.status === "DELIVERED").length;
  const processing = studies.filter((s) =>
    ["PROCESSING", "AI_COMPLETE", "AWAITING_ENGINEER"].includes(s.status),
  ).length;
  const awaiting = studies.filter((s) => s.status === "AWAITING_DOCUMENTS").length;

  const firstName = user.name?.split(" ")[0] ?? null;
  const isCpa = user.role === "CPA";
  const portfolio = buildPortfolioTotals(aggregateInput);
  const showPortfolio = portfolio.deliveredCount >= 1;

  return (
    <Container size="xl" className="py-10 sm:py-14">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        description={
          isCpa
            ? "Your own studies and the ones your clients have shared with you."
            : "All of your properties and studies in one place."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {showPortfolio ? (
              <Button asChild size="lg" variant="outline" leadingIcon={<FileSpreadsheetIcon />}>
                <a href="/api/dashboard/portfolio.csv" download>
                  Export CSV
                </a>
              </Button>
            ) : null}
            <Button asChild size="lg" leadingIcon={<PlusIcon />}>
              <Link href="/pricing">Start a new study</Link>
            </Button>
          </div>
        }
        meta={
          isCpa ? (
            <Badge variant="info" size="sm">
              CPA workspace
            </Badge>
          ) : null
        }
      />

      {showPortfolio ? <PortfolioStrip portfolio={portfolio} /> : null}

      {studies.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard label="Studies" value={studies.length.toString()} />
          <StatCard label="Delivered" value={delivered.toString()} tone="success" />
          <StatCard
            label="In progress"
            value={(processing + awaiting).toString()}
            tone={processing + awaiting > 0 ? "primary" : "muted"}
          />
        </div>
      ) : null}

      <section className="mt-10">
        {studies.length === 0 && sharedStudies.length === 0 && !sharedError ? (
          isCpa ? (
            <CpaEmptyState />
          ) : (
            <CustomerEmptyState />
          )
        ) : studies.length > 0 ? (
          <>
            <h2 className="text-muted-foreground mb-4 font-mono text-sm tracking-[0.18em] uppercase">
              Your studies
            </h2>
            <ul className="space-y-3">
              {studies.map((study) => (
                <StudyCard key={study.id} study={study} nowMs={nowMs} />
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {sharedError ? (
        <Section className="mt-4 !pt-10" divider={false}>
          <div className="border-warning/40 bg-warning/5 rounded-lg border p-5">
            <p className="text-warning-foreground text-sm font-medium">
              We couldn&rsquo;t load studies shared with you.
            </p>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              This is usually a transient database hiccup — refresh in a moment. If it persists,
              email <span className="font-mono">support@costseg.app</span>.
            </p>
          </div>
        </Section>
      ) : sharedStudies.length > 0 ? (
        <Section className="mt-4 !pt-10" divider={false}>
          <h2 className="text-muted-foreground mb-4 font-mono text-sm tracking-[0.18em] uppercase">
            Shared with you
          </h2>
          <ul className="space-y-3">
            {sharedStudies.map((entry) => (
              <SharedStudyCard key={entry.id} entry={entry} />
            ))}
          </ul>
        </Section>
      ) : isCpa ? (
        <Section className="mt-4 !pt-10" divider={false}>
          <h2 className="text-muted-foreground mb-4 font-mono text-sm tracking-[0.18em] uppercase">
            Shared with you
          </h2>
          <Card className="border-dashed">
            <CardContent className="space-y-2 p-8 text-center">
              <p className="text-foreground text-sm font-medium">
                No clients have shared a study yet.
              </p>
              <p className="text-muted-foreground mx-auto max-w-sm text-sm leading-relaxed">
                When your clients run a Cost Seg study, they can share it with you in one click.
                You&rsquo;ll see it here read-only — same schedule and methodology as the owner.
              </p>
            </CardContent>
          </Card>
        </Section>
      ) : null}
    </Container>
  );
}

/**
 * Load the studies that were shared with this user. Returns a discriminated
 * result so the page can distinguish "no shares" (quiet empty) from "DB
 * unavailable" (loud error banner) — the two used to look identical.
 */
async function safeListShared(
  userId: string,
): Promise<
  | { ok: true; shares: Awaited<ReturnType<typeof listStudiesSharedWith>> }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, shares: await listStudiesSharedWith(userId) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "success" | "muted";
}) {
  const color =
    tone === "primary" ? "text-primary" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
          {label}
        </p>
        <p data-tabular className={`mt-1.5 text-3xl font-semibold tracking-tight ${color}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Customer-facing empty state. The dashboard's primary CTA already links to
 * /pricing, so this block leans into the "here's what each tier is and how
 * fast it runs" framing — three direct tier cards so a first-time user can
 * pick without a detour through the pricing page.
 */
function CustomerEmptyState() {
  const tiers: Array<{
    id: "DIY" | "AI_REPORT" | "ENGINEER_REVIEWED";
    title: string;
    price: string;
    turnaround: string;
    description: string;
    featured?: boolean;
  }> = [
    {
      id: "DIY",
      title: "DIY Self-Serve",
      price: "$149",
      turnaround: "Instant",
      description: "Type in your basis + land value. MACRS schedule PDF in 90 seconds.",
    },
    {
      id: "AI_REPORT",
      title: "AI Report",
      price: "$295",
      turnaround: "Minutes",
      description: "Upload your closing disclosure. We read the docs, you watch it run.",
      featured: true,
    },
    {
      id: "ENGINEER_REVIEWED",
      title: "Engineer-Reviewed",
      price: "$1,495",
      turnaround: "3–7 business days",
      description: "AI Report + PE signature. Audit-defensible under IRS Pub 5653.",
    },
  ];

  return (
    <Card className="bg-muted/20 border-dashed">
      <CardContent className="p-8 text-center sm:p-12">
        <div className="bg-primary/10 text-primary mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full">
          <SparklesIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight">
          Let&rsquo;s run your first study.
        </h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm">
          Three tiers, three turnaround times. Pick one and your intake flow starts right away.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {tiers.map((tier) => (
            <Link
              key={tier.id}
              href={`/get-started?tier=${tier.id}` as Route}
              className={cn(
                "group border-border bg-card flex flex-col rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md",
                tier.featured ? "border-primary/40 ring-primary/20 ring-1" : "",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">{tier.title}</p>
                {tier.featured ? (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[9px] font-medium tracking-wider uppercase">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="text-foreground mt-1.5 text-2xl font-semibold tracking-tight">
                {tier.price}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">{tier.turnaround}</p>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                {tier.description}
              </p>
            </Link>
          ))}
        </div>
        <div className="text-muted-foreground mt-6 text-center text-xs">
          Not sure yet?{" "}
          <Link
            href="/samples"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Browse the sample reports
          </Link>
          .
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * CPA-role empty state. A CPA who just accepted an invite doesn't need "let's
 * run YOUR first study" — they're on the dashboard waiting for clients to
 * share studies with them. Frame the state accordingly.
 */
function CpaEmptyState() {
  const subject = encodeURIComponent("Cost Seg — share your study with me");
  const body = encodeURIComponent(
    "Hi,\n\nI can review your Cost Seg study through my CPA account. When you're ready, open the study's pipeline page, click 'Share with your CPA', and enter my email. I'll get read-only access to the schedule and PDF.\n\n— Your CPA",
  );
  return (
    <Card className="bg-muted/20 border-dashed">
      <CardContent className="p-8 text-center sm:p-12">
        <div className="bg-info/10 text-info mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full">
          <SparklesIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight">
          Waiting for a client to share a study.
        </h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm">
          When a client runs a Cost Seg study, they can share it with you in one click. The study
          lands here read-only — same schedule, methodology, and PDF they see.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <a href={`mailto:?subject=${subject}&body=${body}`}>Email a client</a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/partners">How sharing works</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StudyCard({ study, nowMs }: { study: StudyListItem; nowMs: number }) {
  const entry = CATALOG[study.tier];
  const action = computeNextAction({
    status: study.status,
    tier: study.tier,
    updatedAtMs: study.updatedAt.getTime(),
    nowMs,
    missingRequiredDocs: study.requiredDocsMissing,
  });
  const relAge = formatRelativeAge(study.createdAt.getTime(), nowMs);

  // DIY studies go to the simpler self-serve form; AI / Engineer-Reviewed use
  // the full intake wizard with document upload.
  const intakeHref =
    study.status === "AWAITING_DOCUMENTS"
      ? study.tier === "DIY"
        ? (`/studies/${study.id}/diy` as Route)
        : (`/studies/${study.id}/intake` as Route)
      : null;
  const processingHref =
    study.status === "PROCESSING" ||
    study.status === "AI_COMPLETE" ||
    study.status === "AWAITING_ENGINEER" ||
    study.status === "DELIVERED"
      ? (`/studies/${study.id}/processing` as Route)
      : null;
  const canDownload = study.status === "DELIVERED" && Boolean(study.deliverableUrl);

  const hintToneClass =
    action.tone === "primary"
      ? "text-primary"
      : action.tone === "warning"
        ? "text-warning-foreground dark:text-warning"
        : action.tone === "destructive"
          ? "text-destructive"
          : action.tone === "success"
            ? "text-success"
            : "text-muted-foreground";

  const cardBorderClass =
    action.tone === "warning"
      ? "border-warning/40"
      : action.tone === "destructive"
        ? "border-destructive/40"
        : "";

  return (
    <li>
      <Card className={cn("transition hover:shadow-md", cardBorderClass)}>
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="bg-primary/10 text-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <HomeIcon className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="truncate font-medium">
              {study.property.address}, {study.property.city}, {study.property.state}
            </p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
              <Badge variant={study.tier === "ENGINEER_REVIEWED" ? "success" : "default"} size="sm">
                {entry.label}
              </Badge>
              <StudyStatusBadge status={study.status} size="sm" />
              <span>Started {relAge}</span>
            </div>
            <p className={cn("text-xs leading-relaxed", hintToneClass)}>{action.hint}</p>
          </div>
          <div className="flex items-center gap-2">
            {intakeHref ? (
              <Button asChild size="sm" leadingIcon={<PlusIcon />}>
                <Link href={intakeHref}>Continue intake</Link>
              </Button>
            ) : null}
            {processingHref ? (
              <Button asChild size="sm" variant="outline" leadingIcon={<EyeIcon />}>
                <Link href={processingHref}>
                  {study.status === "DELIVERED" ? "View report" : "Watch pipeline"}
                </Link>
              </Button>
            ) : null}
            {canDownload ? (
              <form
                action={async () => {
                  "use server";
                  await downloadMyDeliverableAction(study.id);
                }}
              >
                <Button type="submit" size="sm" variant="secondary" leadingIcon={<DownloadIcon />}>
                  Download
                </Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

type SharedEntry = Awaited<ReturnType<typeof listStudiesSharedWith>>[number];

function SharedStudyCard({ entry }: { entry: SharedEntry }) {
  const entryTier = entry.study.tier;
  const tierLabel = CATALOG[entryTier].label;
  const viewHref = `/studies/${entry.study.id}/view` as Route;
  // Owner identity falls through name → email → "the owner" — the last
  // guard handles a pathological DB row with both columns null/empty.
  const ownerLabel = entry.study.user.name?.trim() || entry.study.user.email?.trim() || "the owner";

  return (
    <li>
      <Card className="transition hover:shadow-md">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="bg-info/10 text-info inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <HomeIcon className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {entry.study.property.address}, {entry.study.property.city},{" "}
              {entry.study.property.state}
            </p>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3 text-xs">
              <Badge variant="info" size="sm">
                Shared by {ownerLabel}
              </Badge>
              <Badge variant={entryTier === "ENGINEER_REVIEWED" ? "success" : "default"} size="sm">
                {tierLabel}
              </Badge>
              <StudyStatusBadge status={entry.study.status} size="sm" />
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={viewHref}>Open read-only view</Link>
          </Button>
        </CardContent>
      </Card>
    </li>
  );
}

function PortfolioStrip({ portfolio }: { portfolio: PortfolioTotals }) {
  const avgPct = `${(portfolio.averageAcceleratedPct * 100).toFixed(1)}%`;
  return (
    <Card className="border-primary/20 bg-primary/5 ring-primary/10 mt-10 shadow-sm ring-1">
      <CardContent className="p-7">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
              Portfolio rollup
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight">
              Across {portfolio.deliveredCount} delivered stud
              {portfolio.deliveredCount === 1 ? "y" : "ies"}
            </p>
          </div>
          <Badge variant="default" size="sm">
            {avgPct} avg accelerated
          </Badge>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Year-1 deduction"
            value={formatCents(portfolio.totalYear1DeductionCents)}
            hint={`≈ ${formatCents(portfolio.totalYear1TaxSavingsCents)} tax savings @ 37%`}
            size="lg"
            tone="accent"
          />
          <Kpi
            label="Accelerated property"
            value={formatCents(portfolio.totalAcceleratedCents)}
            hint="5/7/15-year classes across all studies"
            size="lg"
            tone="primary"
          />
          <Kpi
            label="Depreciable basis"
            value={formatCents(portfolio.totalDepreciableBasisCents)}
            hint="Net of land across all delivered studies"
            size="lg"
          />
          <Kpi
            label="Total purchase price"
            value={formatCents(portfolio.totalPurchasePriceCents)}
            hint={`Across ${portfolio.studyCount} total propert${portfolio.studyCount === 1 ? "y" : "ies"}`}
            size="lg"
            tone="muted"
          />
        </div>
      </CardContent>
    </Card>
  );
}
