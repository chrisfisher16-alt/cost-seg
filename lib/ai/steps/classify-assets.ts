import "server-only";

import { callTool } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import { getAssetLibrary } from "@/lib/ai/asset-library";
import {
  CLASSIFY_ASSETS_PROMPT_VERSION,
  CLASSIFY_ASSETS_SYSTEM,
  CLASSIFY_ASSETS_TOOL,
  buildClassifyAssetsUserPrompt,
  classifyAssetsOutputSchema,
  type ClassifyAssetsInput,
  type ClassifyAssetsOutput,
} from "@/lib/ai/prompts/classify-assets";
import { scrubPiiJson } from "@/lib/ai/scrub";
import { checkBalance, formatBalanceErrorForRetry } from "@/lib/ai/validator";

import type { PropertyType } from "@prisma/client";

export interface ClassifyAssetsOrchestratorInput {
  studyId: string;
  propertyType: PropertyType;
  address: string;
  squareFeet: number | null;
  yearBuilt: number | null;
  buildingValueCents: number;
  improvementLineItems: ClassifyAssetsInput["improvementLineItems"];
}

export interface ClassifyAssetsResult {
  schedule: ClassifyAssetsOutput;
  attempts: number;
  balanced: boolean;
  balanceMessage?: string;
}

/**
 * Step C. Calls the model; if the sum doesn't land within 0.5% of the
 * building value, retries once with the balance error fed back in. Per §7.
 */
export async function classifyAssets(
  input: ClassifyAssetsOrchestratorInput,
): Promise<ClassifyAssetsResult> {
  const library = getAssetLibrary(input.propertyType);
  const basePromptInput: ClassifyAssetsInput = {
    propertyType: input.propertyType,
    address: input.address,
    squareFeet: input.squareFeet,
    yearBuilt: input.yearBuilt,
    buildingValueCents: input.buildingValueCents,
    library,
    improvementLineItems: scrubPiiJson(input.improvementLineItems),
  };

  const firstAttempt = await invoke(input.studyId, basePromptInput, 1);
  const firstCheck = checkBalance(firstAttempt, input.buildingValueCents);
  if (firstCheck.ok) {
    return { schedule: firstAttempt, attempts: 1, balanced: true };
  }

  const secondAttempt = await invoke(
    input.studyId,
    { ...basePromptInput, priorAttemptError: formatBalanceErrorForRetry(firstCheck) },
    2,
  );
  const secondCheck = checkBalance(secondAttempt, input.buildingValueCents);

  return {
    schedule: secondAttempt,
    attempts: 2,
    balanced: secondCheck.ok,
    balanceMessage: secondCheck.ok ? undefined : secondCheck.message,
  };
}

async function invoke(
  studyId: string,
  promptInput: ClassifyAssetsInput,
  attempt: number,
): Promise<ClassifyAssetsOutput> {
  const { output } = await callTool({
    operation: `classify-assets:${studyId}:attempt-${attempt}`,
    promptVersion: CLASSIFY_ASSETS_PROMPT_VERSION,
    model: MODELS.classifyAssets,
    system: CLASSIFY_ASSETS_SYSTEM,
    userMessage: buildClassifyAssetsUserPrompt(promptInput),
    tool: CLASSIFY_ASSETS_TOOL,
    outputSchema: classifyAssetsOutputSchema,
    maxTokens: 4096,
    studyId,
    inputDetails: { attempt, buildingValueCents: promptInput.buildingValueCents },
  });
  return output;
}
