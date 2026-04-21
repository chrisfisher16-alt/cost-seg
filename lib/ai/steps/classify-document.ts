import "server-only";

import { callTool } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  CLASSIFY_DOCUMENT_PROMPT_VERSION,
  CLASSIFY_DOCUMENT_SYSTEM,
  CLASSIFY_DOCUMENT_TOOL,
  buildClassifyDocumentUserPrompt,
  classifyDocumentOutputSchema,
  type ClassifyDocumentOutput,
} from "@/lib/ai/prompts/classify-document";
import { loadDocumentForAi } from "@/lib/ocr/read-document";

export interface ClassifyDocumentInput {
  studyId: string;
  documentId: string;
  filename: string;
  declaredKind: string;
  storagePath: string;
  mimeType: string;
}

export async function classifyDocument(
  input: ClassifyDocumentInput,
): Promise<ClassifyDocumentOutput> {
  const attachment = await loadDocumentForAi(input.storagePath, input.mimeType, input.filename);

  const { output } = await callTool({
    operation: `classify-document:${input.documentId}`,
    promptVersion: CLASSIFY_DOCUMENT_PROMPT_VERSION,
    model: MODELS.classifyDocument,
    system: CLASSIFY_DOCUMENT_SYSTEM,
    userMessage: buildClassifyDocumentUserPrompt({
      filename: input.filename,
      declaredKind: input.declaredKind,
    }),
    attachments: [attachment],
    tool: CLASSIFY_DOCUMENT_TOOL,
    outputSchema: classifyDocumentOutputSchema,
    // 2048 was fine for single-page CD extractions; a spreadsheet of
    // 100+ improvement line items (now a real input via the xlsx
    // route added in lib/ocr/spreadsheet-to-text.ts) needs more room.
    // Sonnet output tokens are cheap — 8192 is well under the model
    // limit and absorbs even pathological ledgers.
    maxTokens: 8192,
    studyId: input.studyId,
    inputDetails: { documentId: input.documentId, declaredKind: input.declaredKind },
  });

  return output;
}
