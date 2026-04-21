import "server-only";

import { callTool } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  DECOMPOSE_PRICE_PROMPT_VERSION,
  DECOMPOSE_PRICE_SYSTEM,
  DECOMPOSE_PRICE_TOOL,
  buildDecomposePriceUserPrompt,
  decomposePriceOutputSchema,
  type DecomposePricePromptEnrichment,
  type DecomposePriceOutput,
} from "@/lib/ai/prompts/decompose-price";
import { scrubPiiJson } from "@/lib/ai/scrub";

export interface DecomposePriceInput {
  studyId: string;
  propertyType: string;
  address: string;
  closingDisclosureFields: Record<string, unknown>;
  /** v2 Phase 4 — optional property enrichment. Drives rule 2 (assessor). */
  enrichment?: DecomposePricePromptEnrichment;
}

export async function decomposePrice(input: DecomposePriceInput): Promise<DecomposePriceOutput> {
  const scrubbedFields = scrubPiiJson(input.closingDisclosureFields);

  const { output } = await callTool({
    operation: `decompose-price:${input.studyId}`,
    promptVersion: DECOMPOSE_PRICE_PROMPT_VERSION,
    model: MODELS.decomposePurchasePrice,
    system: DECOMPOSE_PRICE_SYSTEM,
    userMessage: buildDecomposePriceUserPrompt({
      propertyType: input.propertyType,
      address: input.address,
      closingDisclosureFields: scrubbedFields,
      enrichment: input.enrichment,
    }),
    tool: DECOMPOSE_PRICE_TOOL,
    outputSchema: decomposePriceOutputSchema,
    maxTokens: 1024,
    studyId: input.studyId,
    inputDetails: {
      hasAssessorRatio: Boolean(
        input.enrichment?.assessorLandValueCents &&
        input.enrichment?.assessorTotalValueCents &&
        input.enrichment.assessorTotalValueCents > 0,
      ),
    },
  });

  return output;
}
