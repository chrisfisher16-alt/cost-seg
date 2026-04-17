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
    maxTokens: 2048,
    studyId: input.studyId,
    inputDetails: { documentId: input.documentId, declaredKind: input.declaredKind },
  });

  return output;
}
