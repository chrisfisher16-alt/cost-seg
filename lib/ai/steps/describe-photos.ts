import "server-only";

import { callTool } from "@/lib/ai/call";
import { MODELS } from "@/lib/ai/models";
import {
  DESCRIBE_PHOTOS_PROMPT_VERSION,
  DESCRIBE_PHOTOS_SYSTEM,
  DESCRIBE_PHOTOS_TOOL,
  buildDescribePhotoUserPrompt,
  describePhotoOutputSchema,
  type DescribePhotoOutput,
} from "@/lib/ai/prompts/describe-photos";
import { loadDocumentForAi } from "@/lib/ocr/read-document";

export interface DescribePhotoInput {
  studyId: string;
  documentId: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  roomTagHint?: string | null;
  photoIndex?: number;
  totalPhotos?: number;
}

/**
 * v2 Phase 1 — Step A2: describe one property photo via the vision
 * model. Produces a structured caption + room classification + list of
 * detected depreciable objects. Cached via AiAuditLog keyed on the
 * photo's bytes, so a retry is free.
 */
export async function describePhoto(input: DescribePhotoInput): Promise<DescribePhotoOutput> {
  if (input.mimeType !== "image/jpeg" && input.mimeType !== "image/png") {
    throw new Error(
      `describePhoto: unsupported mimeType ${input.mimeType} for document ${input.documentId}`,
    );
  }
  const attachment = await loadDocumentForAi(input.storagePath, input.mimeType, input.filename);

  const { output } = await callTool({
    operation: `describe-photos:${input.documentId}`,
    promptVersion: DESCRIBE_PHOTOS_PROMPT_VERSION,
    model: MODELS.describePhotos,
    system: DESCRIBE_PHOTOS_SYSTEM,
    userMessage: buildDescribePhotoUserPrompt({
      filename: input.filename,
      roomTagHint: input.roomTagHint ?? null,
      photoIndex: input.photoIndex,
      totalPhotos: input.totalPhotos,
    }),
    attachments: [attachment],
    tool: DESCRIBE_PHOTOS_TOOL,
    outputSchema: describePhotoOutputSchema,
    // Per-photo output is bounded by the tool schema (max 40 detected
    // objects × ~4 short strings each). 4k leaves headroom without
    // enabling cost blow-ups on a pathological photo.
    maxTokens: 4096,
    studyId: input.studyId,
    inputDetails: {
      documentId: input.documentId,
      roomTagHint: input.roomTagHint ?? null,
      photoIndex: input.photoIndex,
      totalPhotos: input.totalPhotos,
    },
  });

  return output;
}
