import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PipelineLive } from "@/components/app/PipelineLive";
import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";
import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { CATALOG } from "@/lib/stripe/catalog";

import { pollProcessingStateAction } from "./actions";

export const metadata: Metadata = {
  title: "Processing your study",
  description: "Watch the pipeline build your cost segregation study in real time.",
};

type Props = {
  params: Promise<{ id: string }>;
};

async function loadStudyMeta(studyId: string) {
  try {
    return await getPrisma().study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        userId: true,
        tier: true,
        property: {
          select: {
            address: true,
            city: true,
            state: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export default async function StudyProcessingPage({ params }: Props) {
  const { id } = await params;
  const { user } = await requireAuth(`/studies/${id}/processing`);

  const study = await loadStudyMeta(id);
  if (!study) notFound();
  assertOwnership(user, { userId: study.userId });

  const entry = CATALOG[study.tier];
  const propertyLabel = `${study.property.address}, ${study.property.city}, ${study.property.state}`;

  const initial = await pollProcessingStateAction(id);
  if (!initial.ok) notFound();

  return (
    <Container size="lg" className="py-10 sm:py-14">
      <PageHeader
        backHref="/dashboard"
        backLabel="Dashboard"
        title={
          initial.isDelivered ? (
            <>
              Your <span className="brand-gradient-text">{entry.label}</span> is ready.
            </>
          ) : initial.isFailed ? (
            "Pipeline paused"
          ) : (
            <>
              Building your <span className="brand-gradient-text">{entry.label}</span>
            </>
          )
        }
        description={
          initial.isDelivered
            ? "Download your PDF, share it with your CPA, and (if you’re filing) upgrade to an Engineer-Reviewed study without re-uploading anything."
            : initial.isFailed
              ? "Something went wrong. Here’s what, and what happens next."
              : "Every step is streaming live. You can close this tab — we’ll email you the moment it’s done."
        }
      />
      <div className="mt-10">
        <PipelineLive
          studyId={id}
          initial={initial}
          propertyLabel={propertyLabel}
          tierLabel={entry.label}
        />
      </div>
    </Container>
  );
}
