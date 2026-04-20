import "server-only";

import { classifyDocument } from "@/lib/ai/steps/classify-document";
import { classifyAssets } from "@/lib/ai/steps/classify-assets";
import { decomposePrice } from "@/lib/ai/steps/decompose-price";
import { draftNarrative } from "@/lib/ai/steps/narrative";
import { getPrisma } from "@/lib/db/client";
import { transitionStudy } from "@/lib/studies/transitions";
import { Prisma, type DocumentKind, type PropertyType, type Tier } from "@prisma/client";

/**
 * Steps of the pipeline broken out so the Inngest function can wrap each
 * in `step.run()` for durability + retry. Every step is idempotent via
 * AiAuditLog caching (§7).
 */

export interface LoadedStudy {
  id: string;
  tier: Tier;
  propertyType: PropertyType;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  acquiredAtIso: string;
  documents: Array<{
    id: string;
    kind: DocumentKind;
    filename: string;
    mimeType: string;
    storagePath: string;
  }>;
}

export async function loadStudyForPipeline(studyId: string): Promise<LoadedStudy> {
  const prisma = getPrisma();
  const row = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      tier: true,
      property: {
        select: {
          propertyType: true,
          address: true,
          squareFeet: true,
          yearBuilt: true,
          acquiredAt: true,
        },
      },
      documents: {
        select: {
          id: true,
          kind: true,
          filename: true,
          mimeType: true,
          storagePath: true,
        },
      },
    },
  });
  if (!row) throw new Error(`Study ${studyId} not found`);
  return {
    id: row.id,
    tier: row.tier,
    propertyType: row.property.propertyType,
    address: row.property.address,
    squareFeet: row.property.squareFeet,
    yearBuilt: row.property.yearBuilt,
    acquiredAtIso: row.property.acquiredAt.toISOString().slice(0, 10),
    documents: row.documents,
  };
}

export type ClassifyDocumentBatch = Array<{
  documentId: string;
  kind: DocumentKind;
  confidence: number;
  extractedFields: Record<string, unknown>;
}>;

export async function runClassifyDocumentsBatch(
  study: LoadedStudy,
): Promise<ClassifyDocumentBatch> {
  const results = await Promise.all(
    study.documents.map(async (doc) => {
      const result = await classifyDocument({
        studyId: study.id,
        documentId: doc.id,
        filename: doc.filename,
        declaredKind: doc.kind,
        storagePath: doc.storagePath,
        mimeType: doc.mimeType,
      });
      return {
        documentId: doc.id,
        kind: result.kind,
        confidence: result.confidence,
        extractedFields: result.extractedFields,
      };
    }),
  );
  return results;
}

/**
 * Persist the classifier's extracted fields onto each Document so the admin
 * inspector + later steps can read structured data without re-calling the model.
 */
export async function persistClassifierFields(batch: ClassifyDocumentBatch): Promise<void> {
  const prisma = getPrisma();
  for (const row of batch) {
    const extractedJson = {
      kind: row.kind,
      confidence: row.confidence,
      extractedFields: row.extractedFields,
    } as Prisma.InputJsonValue;
    await prisma.document.update({
      where: { id: row.documentId },
      data: { extractedJson },
    });
  }
}

export function findClosingDisclosureFields(
  batch: ClassifyDocumentBatch,
): Record<string, unknown> | null {
  const cd = batch.find((row) => row.kind === "CLOSING_DISCLOSURE");
  return cd?.extractedFields ?? null;
}

export function collectImprovementLineItems(
  batch: ClassifyDocumentBatch,
): Array<{ description: string; amountCents: number; dateIso?: string; category?: string }> {
  const out: Array<{
    description: string;
    amountCents: number;
    dateIso?: string;
    category?: string;
  }> = [];
  for (const row of batch) {
    if (row.kind !== "IMPROVEMENT_RECEIPTS") continue;
    const rawItems = row.extractedFields["lineItems"];
    if (!Array.isArray(rawItems)) continue;
    for (const raw of rawItems) {
      if (
        raw &&
        typeof raw === "object" &&
        typeof (raw as Record<string, unknown>).description === "string" &&
        typeof (raw as Record<string, unknown>).amountCents === "number"
      ) {
        const r = raw as Record<string, unknown>;
        out.push({
          description: r.description as string,
          amountCents: r.amountCents as number,
          dateIso: typeof r.dateIso === "string" ? (r.dateIso as string) : undefined,
          category: typeof r.category === "string" ? (r.category as string) : undefined,
        });
      }
    }
  }
  return out;
}

export async function runDecompose(
  study: LoadedStudy,
  closingDisclosureFields: Record<string, unknown>,
) {
  return decomposePrice({
    studyId: study.id,
    propertyType: study.propertyType,
    address: study.address,
    closingDisclosureFields,
  });
}

export async function runClassifyAssets(
  study: LoadedStudy,
  buildingValueCents: number,
  improvements: Array<{
    description: string;
    amountCents: number;
    dateIso?: string;
    category?: string;
  }>,
) {
  return classifyAssets({
    studyId: study.id,
    propertyType: study.propertyType,
    address: study.address,
    squareFeet: study.squareFeet,
    yearBuilt: study.yearBuilt,
    buildingValueCents,
    improvementLineItems: improvements,
  });
}

export async function runNarrative(
  study: LoadedStudy,
  decomposition: Record<string, unknown>,
  schedule: Record<string, unknown>,
) {
  return draftNarrative({
    studyId: study.id,
    promptInput: {
      tier: study.tier,
      propertyType: study.propertyType,
      address: study.address,
      squareFeet: study.squareFeet,
      yearBuilt: study.yearBuilt,
      acquiredAtIso: study.acquiredAtIso,
      decomposition,
      schedule,
    },
  });
}

export interface PipelineFinalize {
  studyId: string;
  tier: Tier;
  decomposition: Record<string, unknown>;
  schedule: Record<string, unknown>;
  narrative: Record<string, unknown>;
  assetScheduleTotalCents: number;
}

export async function finalizeStudy(input: PipelineFinalize): Promise<void> {
  const prisma = getPrisma();
  const nextStatus = input.tier === "ENGINEER_REVIEWED" ? "AWAITING_ENGINEER" : "AI_COMPLETE";
  const assetSchedule = {
    decomposition: input.decomposition,
    schedule: input.schedule,
    narrative: input.narrative,
    totalCents: input.assetScheduleTotalCents,
  } as Prisma.InputJsonValue;

  await prisma.$transaction(async (tx) => {
    await transitionStudy({
      studyId: input.studyId,
      from: "PROCESSING",
      to: nextStatus,
      tier: input.tier,
      extraData: { assetSchedule },
      tx,
    });
    await tx.studyEvent.create({
      data: {
        studyId: input.studyId,
        kind: "pipeline.completed",
        payload: {
          status: nextStatus,
          totalCents: input.assetScheduleTotalCents,
        },
      },
    });
  });

  // Tier 1 auto-delivers via the `study.ai.complete` Inngest chain. Tier 2
  // waits for admin-triggered engineer upload (Phase 7).
  if (input.tier === "AI_REPORT") {
    const { inngest } = await import("@/inngest/client");
    await inngest.send({
      name: "study.ai.complete",
      data: { studyId: input.studyId, tier: input.tier },
    });
  }
}

/**
 * Anything-in-flight → FAILED. Called from inside Inngest steps for
 * unrecoverable pipeline errors, and from admin surfaces for manual
 * marks. The transitions SSOT blocks marking a DELIVERED / REFUNDED /
 * already-FAILED study from this path, so callers don't need a pre-read.
 */
export async function markStudyFailed(studyId: string, reason: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await transitionStudy({
      studyId,
      from: [
        "PENDING_PAYMENT",
        "AWAITING_DOCUMENTS",
        "PROCESSING",
        "AI_COMPLETE",
        "AWAITING_ENGINEER",
        "ENGINEER_REVIEWED",
      ],
      to: "FAILED",
      extraData: { failedReason: reason },
      tx,
    });
    await tx.studyEvent.create({
      data: {
        studyId,
        kind: "pipeline.failed",
        payload: { reason },
      },
    });
  });
}
