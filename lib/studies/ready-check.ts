import "server-only";

import { getPrisma } from "@/lib/db/client";
import { inngest } from "@/inngest/client";
import type { DocumentKind } from "@prisma/client";

/**
 * Documents a buyer MUST upload before the pipeline can start. Improvement
 * receipts stay optional for V1 — some owners simply don't have any.
 */
export const REQUIRED_DOCUMENT_KINDS: readonly DocumentKind[] = [
  "CLOSING_DISCLOSURE",
  "PROPERTY_PHOTO",
] as const;

export interface IntakeCompleteness {
  propertyReady: boolean;
  missingKinds: DocumentKind[];
  complete: boolean;
}

/**
 * Pure check — returns what's missing without touching Inngest. Useful from
 * the UI to show progress.
 */
export async function getIntakeCompleteness(studyId: string): Promise<IntakeCompleteness> {
  const prisma = getPrisma();
  const [study, docs] = await Promise.all([
    prisma.study.findUnique({
      where: { id: studyId },
      select: {
        property: {
          select: { address: true, city: true, state: true, zip: true, purchasePrice: true },
        },
      },
    }),
    prisma.document.findMany({
      where: { studyId },
      select: { kind: true },
    }),
  ]);

  const propertyReady = Boolean(
    study?.property.address &&
    !study.property.address.startsWith("(provided") &&
    study.property.city.length > 0 &&
    study.property.state !== "XX" &&
    /^\d{5}(-\d{4})?$/.test(study.property.zip) &&
    Number(study.property.purchasePrice) > 0,
  );

  const present = new Set(docs.map((d) => d.kind));
  const missingKinds = REQUIRED_DOCUMENT_KINDS.filter((k) => !present.has(k));

  return {
    propertyReady,
    missingKinds,
    complete: propertyReady && missingKinds.length === 0,
  };
}

/**
 * If the study has everything it needs and is still in AWAITING_DOCUMENTS,
 * emit `study.documents.ready` exactly once. Idempotent via a StudyEvent
 * row so repeat calls don't fire duplicates.
 */
export async function emitDocumentsReadyIfComplete(studyId: string): Promise<boolean> {
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, tier: true, status: true },
  });
  if (!study) return false;
  if (study.status !== "AWAITING_DOCUMENTS") return false;

  const completeness = await getIntakeCompleteness(studyId);
  if (!completeness.complete) return false;

  // Guard against double-emit by checking for a previous documents.ready event.
  const prior = await prisma.studyEvent.findFirst({
    where: { studyId, kind: "documents.ready" },
    select: { id: true },
  });
  if (prior) return false;

  await inngest.send({
    name: "study.documents.ready",
    data: { studyId, tier: study.tier },
  });
  await prisma.studyEvent.create({
    data: {
      studyId,
      kind: "documents.ready",
      payload: { requiredKinds: [...REQUIRED_DOCUMENT_KINDS] },
    },
  });
  return true;
}
