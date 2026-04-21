/**
 * Pure helpers for the processing page. Split from `actions.ts` because
 * that file carries `"use server"` and Next.js rejects non-async exports
 * from server-action modules. These helpers are fully deterministic — a
 * study status + event-kind set in, a step list out — and are the unit
 * under test for the "no step is active until the pipeline is actually
 * live" behavior.
 */

export type PipelineStepState = "pending" | "active" | "done" | "error";

export interface PipelineStep {
  id: string;
  label: string;
  description?: string;
  state: PipelineStepState;
  note?: string;
}

export const STEP_ORDER = [
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

export type StepId = (typeof STEP_ORDER)[number]["id"];

/**
 * Maps a study status + event log into a user-facing step list.
 *
 * The `active` state is reserved for steps the pipeline is actually
 * running. Before the pipeline starts (status = AWAITING_DOCUMENTS and no
 * `pipeline.started` event), every pending step stays `pending` — the
 * processing page's "Waiting for worker" banner is the only moving
 * signal, which is truthful. This prevents the "Parsing your documents
 * spinner that never progresses" UI reported on the beta when Inngest
 * hadn't synced the function yet.
 */
export function buildSteps(
  status: string,
  eventKinds: Set<string>,
  failureReason: string | null,
): PipelineStep[] {
  const completed: Partial<Record<StepId, boolean>> = {
    upload: true, // if we're on this page, docs are in
  };
  if (eventKinds.has("pipeline.started")) completed.upload = true;
  if (eventKinds.has("documents.classified")) completed.classify = true;
  if (eventKinds.has("decomposition.complete")) completed.decompose = true;
  if (eventKinds.has("assets.classified")) completed.assets = true;
  if (eventKinds.has("narrative.drafted")) completed.narrative = true;
  if (eventKinds.has("pdf.rendered")) completed.render = true;
  // `deliver.ts` writes `study.delivered` — treat that as the authoritative
  // "render + deliver both done" signal. The PDF renders synchronously
  // right before the DB write, so by the time this event appears the
  // render step is definitively complete too. (`ai.delivered` is legacy
  // — kept for backward compat with any historical events.)
  if (
    eventKinds.has("ai.delivered") ||
    eventKinds.has("study.delivered") ||
    status === "DELIVERED"
  ) {
    completed.deliver = true;
    completed.render = true;
    completed.narrative = true;
    completed.assets = true;
    completed.decompose = true;
    completed.classify = true;
  }

  const isFailed = status === "FAILED";
  const isDelivered = status === "DELIVERED";

  // "Pipeline live" gate: any signal that real work is underway —
  // status past AWAITING_DOCUMENTS OR the `pipeline.started` event was
  // written. Either alone is sufficient; we check both for resilience
  // (e.g. event arrives before the status-flip transaction commits).
  const pipelineLive = status !== "AWAITING_DOCUMENTS" || eventKinds.has("pipeline.started");

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
    if (pipelineLive && !activeFound) {
      activeFound = true;
      return { ...step, state: "active" as const };
    }
    return { ...step, state: "pending" as const };
  });
}
