"use server";

import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";
import { DEFAULT_BRACKET } from "@/lib/estimator/compute";
import { aggregateBasisByClass } from "@/lib/pdf/macrs";
import { computeYearOneProjection } from "@/lib/pdf/year-one";

import { buildSteps, type PipelineStep } from "./pipeline-steps";

export interface ProcessingStateResult {
  ok: true;
  status: string;
  isDelivered: boolean;
  isFailed: boolean;
  failureReason?: string | null;
  steps: PipelineStep[];
  events: Array<{ id: string; kind: string; at: string }>;
  summary: {
    deliverableUrl: string | null;
    acceleratedCents?: number;
    year1DeductionCents?: number;
    year1TaxSavingsCents?: number;
    depreciableBasisCents?: number;
    fiveYearCents?: number;
    sevenYearCents?: number;
    fifteenYearCents?: number;
    thirtyNineYearCents?: number;
    totalAssetCount?: number;
  };
}

export type ProcessingStateErr = { ok: false; error: string };

export async function pollProcessingStateAction(
  studyId: string,
): Promise<ProcessingStateResult | ProcessingStateErr> {
  const { user } = await requireAuth();
  try {
    const prisma = getPrisma();
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        userId: true,
        status: true,
        deliverableUrl: true,
        failedReason: true,
        assetSchedule: true,
      },
    });
    if (!study) return { ok: false, error: "Study not found" };
    assertOwnership(user, { userId: study.userId });

    const events = await prisma.studyEvent.findMany({
      where: { studyId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, kind: true, createdAt: true },
    });

    const eventKinds = new Set(events.map((e) => e.kind));
    const steps = buildSteps(study.status, eventKinds, study.failedReason ?? null);

    // Extract summary numbers from the asset schedule JSON when present. The schema
    // we persist is {decomposition, schedule: {lineItems, assumptions}, narrative,
    // totalCents} — mirrors StoredSchedule in lib/studies/deliver.ts.
    const stored = (study.assetSchedule ?? {}) as {
      decomposition?: { buildingValueCents?: number };
      schedule?: {
        lineItems?: Array<{ category: string; amountCents: number }>;
      };
      totalCents?: number;
    };

    const lineItems = stored.schedule?.lineItems ?? [];
    const basis = aggregateBasisByClass(lineItems);
    const acceleratedCents =
      basis.fiveYrBasisCents + basis.sevenYrBasisCents + basis.fifteenYrBasisCents;
    const projection = lineItems.length > 0 ? computeYearOneProjection(lineItems) : null;
    const year1DeductionCents = projection
      ? projection.bonusEligibleCents + projection.longLifeYear1Cents
      : undefined;

    return {
      ok: true,
      status: study.status,
      isDelivered: study.status === "DELIVERED",
      isFailed: study.status === "FAILED",
      failureReason: study.failedReason ?? null,
      steps,
      events: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        at: e.createdAt.toISOString(),
      })),
      summary: {
        deliverableUrl: study.deliverableUrl ?? null,
        acceleratedCents: acceleratedCents || undefined,
        year1DeductionCents,
        year1TaxSavingsCents: year1DeductionCents
          ? Math.round(year1DeductionCents * DEFAULT_BRACKET)
          : undefined,
        depreciableBasisCents: stored.decomposition?.buildingValueCents,
        fiveYearCents: basis.fiveYrBasisCents || undefined,
        sevenYearCents: basis.sevenYrBasisCents || undefined,
        fifteenYearCents: basis.fifteenYrBasisCents || undefined,
        thirtyNineYearCents:
          (basis.twentySevenHalfCents || 0) + (basis.thirtyNineCents || 0) || undefined,
        totalAssetCount: lineItems.length || undefined,
      },
    };
  } catch (err) {
    console.warn("processing-state poll failed", err);
    return { ok: false, error: "Could not load study state." };
  }
}
