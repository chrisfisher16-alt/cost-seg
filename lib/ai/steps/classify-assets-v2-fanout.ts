import "server-only";

import { callTool } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import { getAssetLibrary } from "@/lib/ai/asset-library";
import {
  CLASSIFY_CANDIDATES_V2_PROMPT_VERSION,
  CLASSIFY_CANDIDATES_V2_SYSTEM,
  CLASSIFY_CANDIDATES_V2_TOOL,
  buildPhotoCandidateUserPrompt,
  buildReceiptsCandidateUserPrompt,
  classifyCandidatesV2OutputSchema,
  type ClassifyCandidatesV2Output,
  type PhotoCandidateInput,
  type ReceiptsCandidateInput,
} from "@/lib/ai/prompts/classify-candidates-v2";
import { scrubPiiJson } from "@/lib/ai/scrub";
import {
  applyResidualPlug,
  formatV2ValidationErrorForRetry,
  validateClassifyAssetsV2,
} from "@/lib/ai/validator-v2";
import { mergeCandidates, type MergeCandidatesResult } from "@/lib/ai/merge-candidates-v2";
import type {
  ClassifyAssetsV2OrchestratorInput,
  ClassifyAssetsV2Result,
} from "@/lib/ai/steps/classify-assets-v2";
import type { DescribePhotoOutput } from "@/lib/ai/prompts/describe-photos";
import { aiPhotoConcurrency, mapWithConcurrency } from "@/lib/studies/map-with-concurrency";

import type { PropertyType } from "@prisma/client";

/**
 * v2 Phase 8 fan-out orchestrator for Step C (ADR 0014).
 *
 * Shape:
 *   1. Build a receipt manifest (name + category per receipt) so
 *      per-photo calls can skip already-covered items.
 *   2. Fan-out: one LLM candidate call per photo with a non-empty
 *      detectedObjects array + one LLM candidate call for receipts.
 *      Each call fits in a 30-90s budget — well under any HTTP timeout.
 *   3. Merge: deterministic dedupe across photo candidates (receipts
 *      never dedupe), residual plug, arithmetic + balance validation.
 *   4. Retry: if the merged schedule fails the balance check (sum of
 *      non-residual > building value), re-run the whole fan-out ONCE
 *      with the validation error threaded into every photo+receipt
 *      prompt. One retry is the same budget as the monolith today.
 *
 * The orchestrator is a pure function over dependency-injected LLM
 * callers so the test suite can drive it with fakes. Production wiring
 * in `inngest/functions/process-study.ts` passes the real per-photo /
 * receipts callers that each run inside their own `step.run(...)` —
 * giving us durable memoization per slice.
 */

const RESIDUAL_CLASS_BY_PROPERTY_TYPE: Record<PropertyType, "27_5yr" | "39yr"> = {
  SINGLE_FAMILY_RENTAL: "27_5yr",
  SMALL_MULTIFAMILY: "27_5yr",
  MID_MULTIFAMILY: "27_5yr",
  SHORT_TERM_RENTAL: "39yr",
  COMMERCIAL: "39yr",
};

export interface FanoutCallers {
  /**
   * Called once per photo with a non-empty detectedObjects list. Must
   * return the structured candidate output (may return an empty array
   * of lineItems if the model decides nothing is classifiable).
   */
  classifyPhoto: (
    input: PhotoCandidateInput,
    attempt: number,
  ) => Promise<ClassifyCandidatesV2Output>;
  /**
   * Called once, with all receipts. Returns one candidate line per
   * receipt entry (or empty array when there are no receipts).
   */
  classifyReceipts: (
    input: ReceiptsCandidateInput,
    attempt: number,
  ) => Promise<ClassifyCandidatesV2Output>;
}

export type FanoutStats = MergeCandidatesResult["stats"] & {
  photoCallCount: number;
  receiptsCallCount: number;
  attempts: number;
};

export interface FanoutResult extends ClassifyAssetsV2Result {
  stats: FanoutStats;
}

/**
 * Production entry point. Builds the production callers (real
 * `callTool` invocations with the candidate prompt + schema) and runs
 * the orchestrator. Tests use `runFanout` directly with fake callers.
 */
export async function classifyAssetsV2Fanout(
  input: ClassifyAssetsV2OrchestratorInput,
): Promise<FanoutResult> {
  const callers: FanoutCallers = {
    classifyPhoto: (promptInput, attempt) =>
      invokePhotoCandidate(input.studyId, promptInput, attempt),
    classifyReceipts: (promptInput, attempt) =>
      invokeReceiptsCandidate(input.studyId, promptInput, attempt),
  };
  return runFanout(input, callers);
}

/**
 * Pure-function orchestrator. Exported for unit tests — the DI seam
 * (callers) lets the test suite stub each fan-out slice's LLM output
 * deterministically.
 */
export async function runFanout(
  input: ClassifyAssetsV2OrchestratorInput,
  callers: FanoutCallers,
): Promise<FanoutResult> {
  const library = getAssetLibrary(input.propertyType);
  const residualClass = RESIDUAL_CLASS_BY_PROPERTY_TYPE[input.propertyType];
  const concurrency = aiPhotoConcurrency();

  const receiptManifest = input.improvementLineItems.map((r) => ({
    description: r.description,
    category: r.category,
  }));

  // Only photos with non-empty detectedObjects get a candidate call.
  // A photo with zero detected objects (blurry, dark, exterior-at-dusk)
  // contributes nothing; skipping keeps per-study cost + call count
  // honest.
  const photosWithObjects = input.photos.filter((p) => p.analysis.detectedObjects.length > 0);

  let photoCallCount = 0;
  let receiptsCallCount = 0;
  let attempts = 0;

  const runOne = async (priorError: string | undefined): Promise<MergeCandidatesResult> => {
    attempts += 1;

    const photoTask = async () => {
      if (photosWithObjects.length === 0) return [] as ClassifyCandidatesV2Output[];
      return mapWithConcurrency(photosWithObjects, concurrency, (photo) => {
        photoCallCount += 1;
        return callers.classifyPhoto(
          {
            propertyType: input.propertyType,
            address: input.address,
            squareFeet: input.squareFeet,
            yearBuilt: input.yearBuilt,
            acquiredAtIso: input.acquiredAtIso,
            buildingValueCents: input.buildingValueCents,
            library,
            photo,
            receiptManifest,
            priorAttemptError: priorError,
          },
          attempts,
        );
      });
    };

    const receiptsTask = async () => {
      if (input.improvementLineItems.length === 0) {
        return { lineItems: [], assumptions: "" } satisfies ClassifyCandidatesV2Output;
      }
      receiptsCallCount += 1;
      return callers.classifyReceipts(
        {
          propertyType: input.propertyType,
          address: input.address,
          squareFeet: input.squareFeet,
          yearBuilt: input.yearBuilt,
          acquiredAtIso: input.acquiredAtIso,
          buildingValueCents: input.buildingValueCents,
          library,
          improvementLineItems: scrubPiiJson(input.improvementLineItems),
          priorAttemptError: priorError,
        },
        attempts,
      );
    };

    // Kick both branches off in parallel — the receipts branch is a
    // single call that can run alongside the first photo batch without
    // any coordination.
    const [photos, receipts] = await Promise.all([photoTask(), receiptsTask()]);

    return mergeCandidates({
      slices: [...photos, receipts],
      buildingValueCents: input.buildingValueCents,
      residualClass,
    });
  };

  // First attempt — no priorError. Thread the v2 orchestrator's
  // `priorAttemptError` (from the review-retry loop per ADR 0013) if
  // the caller supplied one; that's distinct from the fan-out's own
  // balance-retry error.
  let merged = await runOne(input.priorAttemptError);
  let check = validateClassifyAssetsV2(merged.schedule, input.buildingValueCents);

  if (!check.ok) {
    const retryError = formatV2ValidationErrorForRetry(check);
    merged = await runOne(retryError);
    check = validateClassifyAssetsV2(merged.schedule, input.buildingValueCents);
  }

  const plugged = check.ok
    ? applyResidualPlug(merged.schedule, input.buildingValueCents)
    : merged.schedule;

  return {
    schedule: plugged,
    attempts,
    balanced: check.ok,
    balanceMessage: check.ok ? undefined : check.message,
    residualCents: check.residualCents,
    stats: {
      ...merged.stats,
      photoCallCount,
      receiptsCallCount,
      attempts,
    },
  };
}

/**
 * Production invoker for one photo slice. Exported so the Inngest
 * wiring in `process-study.ts` can wrap it in `step.run(id, ...)` per
 * photo + attempt, giving each slice durable memoization that survives
 * HTTP reconnects. Tests bypass this and stub the orchestrator's DI
 * seams directly.
 */
export async function invokePhotoCandidate(
  studyId: string,
  promptInput: PhotoCandidateInput,
  attempt: number,
): Promise<ClassifyCandidatesV2Output> {
  const { output } = await callTool({
    operation: `classify-candidates-v2:${studyId}:photo:${promptInput.photo.documentId}:attempt-${attempt}`,
    promptVersion: CLASSIFY_CANDIDATES_V2_PROMPT_VERSION,
    model: MODELS.classifyAssets,
    system: CLASSIFY_CANDIDATES_V2_SYSTEM,
    userMessage: buildPhotoCandidateUserPrompt(promptInput),
    tool: CLASSIFY_CANDIDATES_V2_TOOL,
    outputSchema: classifyCandidatesV2OutputSchema,
    // Single-photo scope keeps output well under the 32k ceiling even
    // on busy kitchens — a typical photo yields 5–15 candidate lines.
    // 12k headroom fits the worst-observed photo + a retry error block.
    maxTokens: 12_000,
    studyId,
    inputDetails: {
      attempt,
      slice: "photo",
      photoDocumentId: promptInput.photo.documentId,
      filename: promptInput.photo.filename,
      detectedObjectCount: promptInput.photo.analysis.detectedObjects.length,
      buildingValueCents: promptInput.buildingValueCents,
    },
  });
  return output;
}

/** Production invoker for the receipts slice. See `invokePhotoCandidate`. */
export async function invokeReceiptsCandidate(
  studyId: string,
  promptInput: ReceiptsCandidateInput,
  attempt: number,
): Promise<ClassifyCandidatesV2Output> {
  const { output } = await callTool({
    operation: `classify-candidates-v2:${studyId}:receipts:attempt-${attempt}`,
    promptVersion: CLASSIFY_CANDIDATES_V2_PROMPT_VERSION,
    model: MODELS.classifyAssets,
    system: CLASSIFY_CANDIDATES_V2_SYSTEM,
    userMessage: buildReceiptsCandidateUserPrompt(promptInput),
    tool: CLASSIFY_CANDIDATES_V2_TOOL,
    outputSchema: classifyCandidatesV2OutputSchema,
    // Receipts emit one line per receipt entry; 40 receipts × ~300
    // tokens/line ≈ 12k. 16k keeps headroom for the rationale prose.
    maxTokens: 16_000,
    studyId,
    inputDetails: {
      attempt,
      slice: "receipts",
      receiptCount: promptInput.improvementLineItems.length,
      buildingValueCents: promptInput.buildingValueCents,
    },
  });
  return output;
}

/** Exported for tests — satisfies the DI contract from a stubbed response map. */
export type PhotoCandidateFn = FanoutCallers["classifyPhoto"];
export type ReceiptsCandidateFn = FanoutCallers["classifyReceipts"];
