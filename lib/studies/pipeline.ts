import "server-only";

import { classifyDocument } from "@/lib/ai/steps/classify-document";
import { classifyAssets } from "@/lib/ai/steps/classify-assets";
import { classifyAssetsV2 } from "@/lib/ai/steps/classify-assets-v2";
import { decomposePrice } from "@/lib/ai/steps/decompose-price";
import { describePhoto } from "@/lib/ai/steps/describe-photos";
import { enrichProperty } from "@/lib/ai/steps/enrich-property";
import { draftNarrative } from "@/lib/ai/steps/narrative";
import {
  describePhotoOutputSchema,
  type DescribePhotoOutput,
} from "@/lib/ai/prompts/describe-photos";
import {
  enrichPropertyOutputSchema,
  hasAssessorRatio,
  type EnrichPropertyOutput,
} from "@/lib/ai/prompts/enrich-property";
import { getPrisma } from "@/lib/db/client";
import { captureServer } from "@/lib/observability/posthog-server";
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
  propertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  acquiredAtIso: string;
  documents: Array<{
    id: string;
    kind: DocumentKind;
    filename: string;
    mimeType: string;
    storagePath: string;
    roomTag: string | null;
  }>;
  /** Pre-existing enrichment JSON, if any (e.g. from a previous flag-on run). */
  enrichment: EnrichPropertyOutput | null;
}

export async function loadStudyForPipeline(studyId: string): Promise<LoadedStudy> {
  const prisma = getPrisma();
  const row = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      tier: true,
      propertyId: true,
      property: {
        select: {
          propertyType: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          squareFeet: true,
          yearBuilt: true,
          acquiredAt: true,
          enrichmentJson: true,
        },
      },
      documents: {
        select: {
          id: true,
          kind: true,
          filename: true,
          mimeType: true,
          storagePath: true,
          roomTag: true,
        },
      },
    },
  });
  if (!row) throw new Error(`Study ${studyId} not found`);
  const parsedEnrichment = row.property.enrichmentJson
    ? enrichPropertyOutputSchema.safeParse(row.property.enrichmentJson)
    : null;
  return {
    id: row.id,
    tier: row.tier,
    propertyId: row.propertyId,
    propertyType: row.property.propertyType,
    address: row.property.address,
    city: row.property.city,
    state: row.property.state,
    zip: row.property.zip,
    squareFeet: row.property.squareFeet,
    yearBuilt: row.property.yearBuilt,
    acquiredAtIso: row.property.acquiredAt.toISOString().slice(0, 10),
    documents: row.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      filename: d.filename,
      mimeType: d.mimeType,
      storagePath: d.storagePath,
      roomTag: d.roomTag,
    })),
    enrichment: parsedEnrichment?.success ? parsedEnrichment.data : null,
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

/**
 * v2 Phase 1 — Step A2. Run the vision describer on every PROPERTY_PHOTO
 * upload in parallel. Non-photo uploads are silently skipped.
 *
 * This step is ADDITIVE to Step A: the existing classifier still runs
 * on every photo and populates `extractedJson` with a short description;
 * this step populates the richer `photoAnalysis` column on photo docs
 * only. Phase 2's classify-assets rewrite consumes `photoAnalysis` to
 * build per-detected-object line items.
 */
export type DescribePhotoBatch = Array<{
  documentId: string;
  output: DescribePhotoOutput;
}>;

export async function runDescribePhotosBatch(study: LoadedStudy): Promise<DescribePhotoBatch> {
  const photoDocs = study.documents.filter((d) => d.kind === "PROPERTY_PHOTO");
  if (photoDocs.length === 0) return [];

  const totalPhotos = photoDocs.length;
  const results = await Promise.all(
    photoDocs.map(async (doc, idx) => {
      const output = await describePhoto({
        studyId: study.id,
        documentId: doc.id,
        filename: doc.filename,
        storagePath: doc.storagePath,
        mimeType: doc.mimeType,
        roomTagHint: doc.roomTag,
        photoIndex: idx + 1,
        totalPhotos,
      });
      return { documentId: doc.id, output };
    }),
  );
  return results;
}

/**
 * Persist the describer's structured output onto each photo Document.
 * `photoAnalysis` becomes the source of truth for Phase 2 + the PDF
 * template; the describer runs once per photo (AiAuditLog caching) so
 * writing this column is idempotent on pipeline retry.
 */
export async function persistPhotoAnalysis(batch: DescribePhotoBatch): Promise<void> {
  const prisma = getPrisma();
  for (const row of batch) {
    await prisma.document.update({
      where: { id: row.documentId },
      data: {
        photoAnalysis: row.output as unknown as Prisma.InputJsonValue,
      },
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
  const enrichment = study.enrichment;
  return decomposePrice({
    studyId: study.id,
    propertyType: study.propertyType,
    address: study.address,
    closingDisclosureFields,
    enrichment: enrichment
      ? {
          assessorLandValueCents: enrichment.assessorLandValueCents ?? null,
          assessorTotalValueCents: enrichment.assessorTotalValueCents ?? null,
          assessorTaxYear: enrichment.assessorTaxYear ?? null,
          assessorUrl: enrichment.assessorUrl ?? null,
        }
      : undefined,
  });
}

/**
 * v2 Phase 4 (ADR 0011) — look up assessor + listing data for the
 * property and persist the result on Property.enrichmentJson. Returns
 * the fresh enrichment so the caller can reuse it inside the same
 * pipeline run without a re-read.
 */
export async function runEnrichProperty(study: LoadedStudy): Promise<EnrichPropertyOutput> {
  return enrichProperty({
    propertyId: study.propertyId,
    address: study.address,
    city: study.city,
    state: study.state,
    zip: study.zip,
    propertyType: study.propertyType,
    intakeSquareFeet: study.squareFeet,
    intakeYearBuilt: study.yearBuilt,
  });
}

export async function persistEnrichment(
  propertyId: string,
  enrichment: EnrichPropertyOutput,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.property.update({
    where: { id: propertyId },
    data: { enrichmentJson: enrichment as unknown as Prisma.InputJsonValue },
  });
}

export { hasAssessorRatio };

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

/**
 * v2 classifier entry point. Fetches persisted photoAnalysis rows from
 * the DB (populated by Phase 1) and hands them to `classifyAssetsV2`
 * alongside receipts + property facts. Photo documents with missing or
 * malformed analysis are skipped — the prompt tolerates photo-less runs.
 */
export async function runClassifyAssetsV2(
  study: LoadedStudy,
  buildingValueCents: number,
  improvements: Array<{
    description: string;
    amountCents: number;
    dateIso?: string;
    category?: string;
  }>,
) {
  const prisma = getPrisma();
  const photoDocs = study.documents.filter((d) => d.kind === "PROPERTY_PHOTO");
  const photos: Array<{
    documentId: string;
    filename: string;
    analysis: DescribePhotoOutput;
  }> = [];

  if (photoDocs.length > 0) {
    const rows = await prisma.document.findMany({
      where: { id: { in: photoDocs.map((d) => d.id) } },
      select: { id: true, filename: true, photoAnalysis: true },
    });
    for (const row of rows) {
      if (!row.photoAnalysis) continue;
      const parsed = describePhotoOutputSchema.safeParse(row.photoAnalysis);
      if (!parsed.success) continue;
      photos.push({ documentId: row.id, filename: row.filename, analysis: parsed.data });
    }
  }

  return classifyAssetsV2({
    studyId: study.id,
    propertyType: study.propertyType,
    address: study.address,
    squareFeet: study.squareFeet,
    yearBuilt: study.yearBuilt,
    acquiredAtIso: study.acquiredAtIso,
    buildingValueCents,
    photos,
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

  // Resolve userId for the analytics event. The StudyEvent above is keyed
  // on studyId; PostHog wants a user distinctId so the funnel joins cleanly.
  const row = await prisma.study.findUnique({
    where: { id: input.studyId },
    select: { userId: true },
  });
  await captureServer(row?.userId ?? `study:${input.studyId}`, "study_ai_complete", {
    studyId: input.studyId,
    tier: input.tier,
    nextStatus,
    totalCents: input.assetScheduleTotalCents,
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
