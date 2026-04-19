"use server";

import { assertOwnership, requireAuth } from "@/lib/auth/require";
import { getPrisma } from "@/lib/db/client";

export type PipelineStepState = "pending" | "active" | "done" | "error";

export interface PipelineStep {
  id: string;
  label: string;
  description?: string;
  state: PipelineStepState;
  note?: string;
}

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
    depreciableBasisCents?: number;
    fiveYearCents?: number;
    fifteenYearCents?: number;
    thirtyNineYearCents?: number;
    totalAssetCount?: number;
  };
}

export type ProcessingStateErr = { ok: false; error: string };

const STEP_ORDER = [
  {
    id: "upload",
    label: "Documents received",
    description: "Closing disclosure, receipts, and photos accepted",
  },
  {
    id: "classify",
    label: "Parsing your documents",
    description: "Claude reads the closing disclosure and extracts key fields",
  },
  {
    id: "decompose",
    label: "Decomposing basis — land vs. building",
    description: "Assessor-ratio allocation with market comparables",
  },
  {
    id: "assets",
    label: "Classifying every asset",
    description: "5-, 7-, 15-, and 39-year MACRS classes with Section 1245/1250 rationale",
  },
  {
    id: "narrative",
    label: "Writing the methodology narrative",
    description: "Regulatory citations, condition assessments, and justifications",
  },
  {
    id: "render",
    label: "Rendering your branded PDF",
    description: "Cover page, exec summary, full schedule, appendix",
  },
  {
    id: "deliver",
    label: "Delivering your report",
    description: "Email + dashboard download link",
  },
] as const;

type StepId = (typeof STEP_ORDER)[number]["id"];

/**
 * Maps a study status + event log into a user-facing step list.
 */
function buildSteps(
  status: string,
  eventKinds: Set<string>,
  failureReason: string | null,
): PipelineStep[] {
  const completed: Partial<Record<StepId, boolean>> = {
    upload: true, // if we're on this page, docs are in
  };
  // Map event kinds emitted by the pipeline to UI step ids.
  if (eventKinds.has("pipeline.started")) completed.upload = true;
  if (eventKinds.has("documents.classified") || status !== "AWAITING_DOCUMENTS") {
    // If we've moved past awaiting docs, classification is at minimum underway.
  }
  if (eventKinds.has("documents.classified")) completed.classify = true;
  if (eventKinds.has("decomposition.complete")) completed.decompose = true;
  if (eventKinds.has("assets.classified")) completed.assets = true;
  if (eventKinds.has("narrative.drafted")) completed.narrative = true;
  if (eventKinds.has("pdf.rendered")) completed.render = true;
  if (eventKinds.has("ai.delivered") || status === "DELIVERED") {
    completed.deliver = true;
    completed.render = true;
    completed.narrative = true;
    completed.assets = true;
    completed.decompose = true;
    completed.classify = true;
  }

  // Pick the first incomplete step as active (unless we failed or delivered).
  const isFailed = status === "FAILED";
  const isDelivered = status === "DELIVERED";

  let activeFound = false;
  return STEP_ORDER.map((step) => {
    const done = completed[step.id];
    if (done) {
      return { ...step, state: "done" as const };
    }
    if (isFailed && !activeFound) {
      activeFound = true;
      return { ...step, state: "error" as const, note: failureReason ?? undefined };
    }
    if (isDelivered) {
      return { ...step, state: "done" as const };
    }
    if (!activeFound) {
      activeFound = true;
      return { ...step, state: "active" as const };
    }
    return { ...step, state: "pending" as const };
  });
}

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

    // Extract summary numbers from the asset schedule JSON if present.
    const schedule = (study.assetSchedule ?? {}) as {
      decomposition?: { buildingValueCents?: number };
      totals?: {
        acceleratedCents?: number;
        year1DeductionCents?: number;
        fiveYearCents?: number;
        fifteenYearCents?: number;
        thirtyNineYearCents?: number;
      };
      schedule?: Array<unknown>;
    };

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
        acceleratedCents: schedule.totals?.acceleratedCents,
        year1DeductionCents: schedule.totals?.year1DeductionCents,
        depreciableBasisCents: schedule.decomposition?.buildingValueCents,
        fiveYearCents: schedule.totals?.fiveYearCents,
        fifteenYearCents: schedule.totals?.fifteenYearCents,
        thirtyNineYearCents: schedule.totals?.thirtyNineYearCents,
        totalAssetCount: schedule.schedule?.length,
      },
    };
  } catch (err) {
    console.warn("processing-state poll failed", err);
    return { ok: false, error: "Could not load study state." };
  }
}
