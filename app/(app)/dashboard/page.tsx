import type { Route } from "next";
import Link from "next/link";
import { DownloadIcon, EyeIcon, HomeIcon, PlusIcon, SparklesIcon } from "lucide-react";

import { downloadMyDeliverableAction } from "./actions";
import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";
import { StudyStatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { CATALOG } from "@/lib/stripe/catalog";

export const metadata = { title: "Dashboard" };

type StudyListItem = {
  id: string;
  tier: "AI_REPORT" | "ENGINEER_REVIEWED";
  status: string;
  createdAt: Date;
  deliverableUrl: string | null;
  property: { address: string; city: string; state: string };
};

async function listStudies(userId: string): Promise<StudyListItem[]> {
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
        deliverableUrl: true,
        property: { select: { address: true, city: true, state: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const studies = await listStudies(user.id);

  const delivered = studies.filter((s) => s.status === "DELIVERED").length;
  const processing = studies.filter((s) =>
    ["PROCESSING", "AI_COMPLETE", "AWAITING_ENGINEER"].includes(s.status),
  ).length;
  const awaiting = studies.filter((s) => s.status === "AWAITING_DOCUMENTS").length;

  const firstName = user.name?.split(" ")[0] ?? null;

  return (
    <Container size="xl" className="py-10 sm:py-14">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}.` : "Welcome back."}
        description="All of your properties and studies in one place."
        actions={
          <Button asChild size="lg" leadingIcon={<PlusIcon />}>
            <Link href="/pricing">Start a new study</Link>
          </Button>
        }
      />

      {studies.length > 0 ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
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
        {studies.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {studies.map((study) => (
              <StudyCard key={study.id} study={study} />
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
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

function EmptyState() {
  return (
    <Card className="bg-muted/20 border-dashed">
      <CardContent className="p-10 text-center sm:p-14">
        <div className="bg-primary/10 text-primary mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full">
          <SparklesIcon className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight">
          Let&rsquo;s run your first study.
        </h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm">
          Pick a tier, upload your closing disclosure, and we&rsquo;ll have your report in minutes.
          No property on file yet.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { n: 1, t: "Choose a tier", b: "DIY, AI Report, or Engineer-Reviewed." },
            { n: 2, t: "Upload 3 documents", b: "Closing disclosure, receipts, photos." },
            { n: 3, t: "Watch it finish", b: "Live pipeline. PDF in minutes." },
          ].map((s) => (
            <div key={s.n} className="border-border bg-card rounded-lg border p-4 text-left">
              <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
                Step {s.n}
              </p>
              <p className="mt-1.5 text-sm font-semibold">{s.t}</p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{s.b}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" leadingIcon={<PlusIcon />}>
            <Link href="/pricing">Start your first study</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/samples">Browse a sample first</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StudyCard({ study }: { study: StudyListItem }) {
  const entry = CATALOG[study.tier];

  const intakeHref =
    study.status === "AWAITING_DOCUMENTS" ? (`/studies/${study.id}/intake` as Route) : null;
  const processingHref =
    study.status === "PROCESSING" ||
    study.status === "AI_COMPLETE" ||
    study.status === "AWAITING_ENGINEER" ||
    study.status === "DELIVERED"
      ? (`/studies/${study.id}/processing` as Route)
      : null;
  const canDownload = study.status === "DELIVERED" && Boolean(study.deliverableUrl);

  return (
    <li>
      <Card className="transition hover:shadow-md">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          <div className="bg-primary/10 text-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
            <HomeIcon className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {study.property.address}, {study.property.city}, {study.property.state}
            </p>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-3 text-xs">
              <Badge variant={study.tier === "ENGINEER_REVIEWED" ? "success" : "default"} size="sm">
                {entry.label}
              </Badge>
              <span>Started {study.createdAt.toLocaleDateString()}</span>
              <StudyStatusBadge status={study.status} size="sm" />
            </div>
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
