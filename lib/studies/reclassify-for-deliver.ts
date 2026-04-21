import "server-only";

import { classifyAssetsV2 } from "@/lib/ai/steps/classify-assets-v2";
import { describePhotoOutputSchema } from "@/lib/ai/prompts/describe-photos";
import { getPrisma } from "@/lib/db/client";

import type { PropertyType } from "@prisma/client";
import type { ReclassifyResult } from "@/lib/studies/review-retry-loop";

import { Prisma } from "@prisma/client";

/**
 * v2 Phase 7 slice 3 (ADR 0013) — re-run the v2 classifier with a
 * review-supplied `priorAttemptError`, persist the new schedule onto
 * `Study.assetSchedule`, and return the fresh line items so the
 * retry loop can re-render.
 *
 * Lives here (not in `pipeline.ts`) because it's delivery-phase:
 * the classifier already ran once during `processStudy`, so the
 * persisted study has everything we need (documents, improvements,
 * decomposition). We just re-do Step C with a targeted hint.
 *
 * Cache semantics: `classifyAssetsV2` calls flow through
 * `lib/ai/call.ts` where the idempotency key includes the prompt
 * user-message hash. A different `priorAttemptError` → different
 * hash → cache miss → real call. Safe to call multiple times with
 * different hints within the retry cap.
 */

export interface ReclassifyStoredSchedule {
  schema: "v2";
  decomposition: {
    purchasePriceCents: number;
    landValueCents: number;
    buildingValueCents: number;
    landAllocationPct: number;
    methodology: string;
    confidence: number;
  };
  schedule: {
    lineItems: Array<Record<string, unknown>>;
    assumptions: string;
  };
  narrative: Record<string, unknown>;
  totalCents: number;
}

export async function reclassifyV2ForDeliver(
  studyId: string,
  priorAttemptError: string,
): Promise<ReclassifyResult> {
  const prisma = getPrisma();
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      assetSchedule: true,
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
          photoAnalysis: true,
          extractedJson: true,
        },
      },
    },
  });
  if (!study) throw new Error(`reclassifyV2ForDeliver: study ${studyId} not found`);
  if (!study.assetSchedule) {
    throw new Error(`reclassifyV2ForDeliver: study ${studyId} has no assetSchedule`);
  }
  const stored = study.assetSchedule as unknown as ReclassifyStoredSchedule;
  if (stored.schema !== "v2") {
    throw new Error(
      `reclassifyV2ForDeliver: study ${studyId} schedule is not v2 (got ${String(
        (stored as { schema?: unknown }).schema,
      )})`,
    );
  }

  // Hydrate the per-photo analysis list from Document rows, skipping
  // anything that doesn't parse. Same pattern as `runClassifyAssetsV2`
  // in pipeline.ts.
  const photos: Array<{
    documentId: string;
    filename: string;
    analysis: ReturnType<typeof describePhotoOutputSchema.parse>;
  }> = [];
  for (const doc of study.documents) {
    if (doc.kind !== "PROPERTY_PHOTO") continue;
    if (!doc.photoAnalysis) continue;
    const parsed = describePhotoOutputSchema.safeParse(doc.photoAnalysis);
    if (!parsed.success) continue;
    photos.push({ documentId: doc.id, filename: doc.filename, analysis: parsed.data });
  }

  // Reconstruct the improvement-receipts line items from Step A's
  // stored extractions. Matches `collectImprovementLineItems` in
  // pipeline.ts but runs against the same `Document.extractedJson`
  // rows that the first classifier call consumed.
  const improvements: Array<{
    description: string;
    amountCents: number;
    dateIso?: string;
    category?: string;
  }> = [];
  for (const doc of study.documents) {
    if (doc.kind !== "IMPROVEMENT_RECEIPTS") continue;
    const raw = doc.extractedJson as { extractedFields?: { lineItems?: unknown } } | null;
    const items = raw?.extractedFields?.lineItems;
    if (!Array.isArray(items)) continue;
    for (const it of items) {
      if (
        it &&
        typeof it === "object" &&
        typeof (it as Record<string, unknown>).description === "string" &&
        typeof (it as Record<string, unknown>).amountCents === "number"
      ) {
        const r = it as Record<string, unknown>;
        improvements.push({
          description: r.description as string,
          amountCents: r.amountCents as number,
          dateIso: typeof r.dateIso === "string" ? (r.dateIso as string) : undefined,
          category: typeof r.category === "string" ? (r.category as string) : undefined,
        });
      }
    }
  }

  const classified = await classifyAssetsV2({
    studyId,
    propertyType: study.property.propertyType as PropertyType,
    address: study.property.address,
    squareFeet: study.property.squareFeet,
    yearBuilt: study.property.yearBuilt,
    acquiredAtIso: study.property.acquiredAt.toISOString().slice(0, 10),
    buildingValueCents: stored.decomposition.buildingValueCents,
    photos,
    improvementLineItems: improvements,
    priorAttemptError,
  });

  if (!classified.balanced) {
    throw new Error(
      `reclassifyV2ForDeliver: classifier did not balance after review retry: ${
        classified.balanceMessage ?? "unknown"
      }`,
    );
  }

  const newLineItems = classified.schedule.lineItems;
  const newTotalCents = newLineItems.reduce((acc, li) => acc + li.adjustedCostCents, 0);

  // Persist the new v2 schedule so Study.assetSchedule reflects the
  // actual shipped schedule. Keeps decomposition + narrative stable;
  // only the schedule + totalCents change. Preserves the schema
  // discriminator Phase 5 depends on.
  const nextAssetSchedule: ReclassifyStoredSchedule = {
    schema: "v2",
    decomposition: stored.decomposition,
    schedule: {
      lineItems: newLineItems as unknown as Array<Record<string, unknown>>,
      assumptions: classified.schedule.assumptions,
    },
    narrative: stored.narrative,
    totalCents: newTotalCents,
  };
  await prisma.study.update({
    where: { id: studyId },
    data: {
      assetSchedule: nextAssetSchedule as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    lineItems: newLineItems as unknown as unknown[],
    totalCents: newTotalCents,
  };
}
