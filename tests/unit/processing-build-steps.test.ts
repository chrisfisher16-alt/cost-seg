import { describe, expect, it } from "vitest";

import { buildSteps } from "@/app/(app)/studies/[id]/processing/pipeline-steps";

/**
 * Regression test for the "Parsing your documents" animation-without-progress
 * bug reported on the beta:
 *
 *   - Customer clicked "Start my report" and landed on `/processing`.
 *   - Inngest hadn't synced the `process-study` function yet (SSO was
 *     blocking the sync POST to `/api/inngest`), so the pipeline never
 *     ran.
 *   - The processing page showed "Parsing your documents" with a spinner
 *     while the study's actual status was still AWAITING_DOCUMENTS, which
 *     lied to the customer about whether anything was happening.
 *
 * The fix: no step is flagged `active` until the pipeline has actually
 * started — either status has moved past AWAITING_DOCUMENTS, or a
 * `pipeline.started` StudyEvent is present. Before that, the next step
 * stays `pending` and the page's "Waiting for worker" banner is the only
 * moving signal, which is truthful.
 */

const STEP_IDS = [
  "upload",
  "classify",
  "decompose",
  "assets",
  "narrative",
  "render",
  "deliver",
] as const;

function pick(steps: ReturnType<typeof buildSteps>, id: (typeof STEP_IDS)[number]) {
  const match = steps.find((s) => s.id === id);
  if (!match) throw new Error(`step not found: ${id}`);
  return match;
}

describe("buildSteps — honest `active` state", () => {
  it("AWAITING_DOCUMENTS with no pipeline.started event: no step is 'active'", () => {
    const steps = buildSteps("AWAITING_DOCUMENTS", new Set(), null);
    expect(pick(steps, "upload").state).toBe("done");
    for (const id of [
      "classify",
      "decompose",
      "assets",
      "narrative",
      "render",
      "deliver",
    ] as const) {
      expect(pick(steps, id).state).toBe("pending");
    }
  });

  it("AWAITING_DOCUMENTS with pipeline.started event present: classify is 'active'", () => {
    // Edge case — the pipeline started and emitted the event, but the
    // `mark-processing` step hasn't committed the status flip yet. The
    // event is authoritative, so the UI can light up classify.
    const steps = buildSteps("AWAITING_DOCUMENTS", new Set(["pipeline.started"]), null);
    expect(pick(steps, "upload").state).toBe("done");
    expect(pick(steps, "classify").state).toBe("active");
  });

  it("PROCESSING status: classify is 'active' even without the event", () => {
    const steps = buildSteps("PROCESSING", new Set(), null);
    expect(pick(steps, "classify").state).toBe("active");
  });

  it("PROCESSING + documents.classified: decompose is the next 'active'", () => {
    const steps = buildSteps("PROCESSING", new Set(["documents.classified"]), null);
    expect(pick(steps, "classify").state).toBe("done");
    expect(pick(steps, "decompose").state).toBe("active");
  });

  it("DELIVERED: every step is 'done'", () => {
    const steps = buildSteps("DELIVERED", new Set(), null);
    for (const id of STEP_IDS) {
      expect(pick(steps, id).state).toBe("done");
    }
  });

  it("FAILED with reason: first non-done step shows 'error' with the note", () => {
    const steps = buildSteps(
      "FAILED",
      new Set(["documents.classified"]),
      "Step B could not balance.",
    );
    expect(pick(steps, "classify").state).toBe("done");
    expect(pick(steps, "decompose").state).toBe("error");
    expect(pick(steps, "decompose").note).toBe("Step B could not balance.");
    // Remaining steps stay pending — not a cascade of errors.
    expect(pick(steps, "assets").state).toBe("pending");
  });
});
