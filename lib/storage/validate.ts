import "server-only";

import { fileTypeFromBuffer } from "file-type";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * MIME allowlist across every intake DocumentKind. Specific kinds may narrow
 * this further in the client (e.g. property photos block PDFs), but this is
 * the maximum surface the server will validate against.
 *
 *   - application/pdf         — closing disclosures, appraisals, receipts
 *   - image/jpeg, image/png   — property photos
 *   - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *                             — modern Excel (xlsx) receipts / ledgers
 *   - application/vnd.ms-excel — legacy Excel (xls) receipts / ledgers
 */
export const ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
] as const;

export type AllowedMime = (typeof ALLOWED_MIMES)[number];

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}

export interface UploadValidation {
  ok: boolean;
  error?: string;
  detectedMime?: AllowedMime;
}

/**
 * Validate an uploaded file by:
 *   1. size cap (ADR 0003, 25MB)
 *   2. MIME allowlist on the declared type
 *   3. magic-byte sniff of the actual bytes, matched against the declared MIME
 *
 * Together these provide the V1 content-safety posture in lieu of AV (ADR 0003).
 */
export async function validateUploadedFile(
  blob: Blob,
  declaredMime: string,
): Promise<UploadValidation> {
  if (blob.size === 0) {
    return { ok: false, error: "File is empty." };
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit.`,
    };
  }
  if (!isAllowedMime(declaredMime)) {
    return {
      ok: false,
      error: `File type ${declaredMime} is not accepted. Use PDF, JPG, PNG, or XLSX/XLS.`,
    };
  }

  // fileTypeFromBuffer works on a typed array; Blob -> ArrayBuffer -> Uint8Array.
  // We only need the first few KB to determine the type, so cap the read.
  const sample = await blob.slice(0, 4096).arrayBuffer();
  const detected = await fileTypeFromBuffer(new Uint8Array(sample));
  if (!detected) {
    return { ok: false, error: "Could not identify file type." };
  }
  if (!isAllowedMime(detected.mime)) {
    return {
      ok: false,
      error: `Detected file type ${detected.mime} is not accepted.`,
    };
  }
  if (detected.mime !== declaredMime) {
    return {
      ok: false,
      error: "File content does not match its declared type.",
    };
  }
  return { ok: true, detectedMime: detected.mime };
}
