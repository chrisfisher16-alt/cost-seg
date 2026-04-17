import "server-only";

import { callTool } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  NARRATIVE_PROMPT_VERSION,
  NARRATIVE_SYSTEM,
  NARRATIVE_TOOL,
  buildNarrativeUserPrompt,
  narrativeOutputSchema,
  type NarrativeOutput,
  type NarrativePromptInput,
} from "@/lib/ai/prompts/narrative";

export interface DraftNarrativeInput {
  studyId: string;
  promptInput: NarrativePromptInput;
}

export async function draftNarrative(input: DraftNarrativeInput): Promise<NarrativeOutput> {
  const { output } = await callTool({
    operation: `narrative:${input.studyId}`,
    promptVersion: NARRATIVE_PROMPT_VERSION,
    model: MODELS.draftNarrative,
    system: NARRATIVE_SYSTEM,
    userMessage: buildNarrativeUserPrompt(input.promptInput),
    tool: NARRATIVE_TOOL,
    outputSchema: narrativeOutputSchema,
    maxTokens: 4096,
    studyId: input.studyId,
    inputDetails: { tier: input.promptInput.tier },
  });
  return output;
}
