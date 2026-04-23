import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the ADR 0014 dispatch in process-study.ts:
 *   • flag-gated selection between fan-out / monolith / v1
 *   • per-slice step.run ids include the photo documentId + attempt
 *     so Inngest memoizes each slice independently across retries
 *   • the dedupe-stats StudyEvent fires after the classifier
 *
 * Structural rather than behavioral — spinning up a real Inngest
 * function context in vitest is a lot of scaffolding for guarding
 * well-shaped glue code.
 */

const PROCESS_STUDY_PATH = resolve(
  __dirname,
  "..",
  "..",
  "inngest",
  "functions",
  "process-study.ts",
);

const src = readFileSync(PROCESS_STUDY_PATH, "utf8");

describe("process-study fan-out dispatch (ADR 0014)", () => {
  it("imports isV2ClassifierFanoutEnabled from the feature flag module", () => {
    expect(src).toMatch(/isV2ClassifierFanoutEnabled/);
    expect(src).toMatch(/@\/lib\/features\/v2-report/);
  });

  it("requires V2_REPORT_CLASSIFIER to be on before fan-out can run", () => {
    // The guard: useV2Fanout = useV2Classifier && isV2ClassifierFanoutEnabled().
    // Flipping fan-out without the classifier flag is nonsensical (v1
    // schedules have no per-object shape to fan out over), so dispatch
    // must short-circuit when the classifier flag is off.
    expect(src).toMatch(/useV2Classifier\s*&&\s*isV2ClassifierFanoutEnabled\(\)/);
  });

  it("wires the fan-out branch with per-photo + per-attempt step.run ids", () => {
    // Photo slices: step-c-candidates-photo-{documentId}-attempt-{n}.
    // Inngest memoizes by id, so a retry replays finished slices from
    // cache and only re-executes the slice that failed.
    expect(src).toMatch(
      /step-c-candidates-photo-\$\{promptInput\.photo\.documentId\}-attempt-\$\{attempt\}/,
    );
    // Receipts slice: one step per attempt.
    expect(src).toMatch(/step-c-candidates-receipts-attempt-\$\{attempt\}/);
  });

  it("passes the real LLM invokers into runFanout", () => {
    expect(src).toContain("invokePhotoCandidate");
    expect(src).toContain("invokeReceiptsCandidate");
    expect(src).toMatch(/runFanout\(orchestratorInput/);
  });

  it("emits a classifier.dedupe_stats StudyEvent when fan-out ran", () => {
    expect(src).toContain("classifier.dedupe_stats");
    // Only emit when fanoutStats is present (monolith path skips it).
    expect(src).toMatch(/if\s*\(\s*fanoutStats\s*\)/);
  });

  it("keeps the monolith v2 path intact for the flag-off rollout window", () => {
    expect(src).toMatch(/step-c-classify-assets-v2/);
    expect(src).toContain("pipeline.runClassifyAssetsV2(");
  });

  it("keeps the v1 path intact for non-v2 studies", () => {
    expect(src).toMatch(/step-c-classify-assets/);
    expect(src).toContain("pipeline.runClassifyAssets(");
  });
});
