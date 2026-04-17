import { describe, expect, it } from "vitest";

import {
  ALLOWED_MIMES,
  MAX_UPLOAD_BYTES,
  isAllowedMime,
  validateUploadedFile,
} from "@/lib/storage/validate";
import { storageKey } from "@/lib/storage/studies";

describe("isAllowedMime", () => {
  it("accepts the allowlist", () => {
    for (const mime of ALLOWED_MIMES) {
      expect(isAllowedMime(mime)).toBe(true);
    }
  });

  it("rejects other types", () => {
    expect(isAllowedMime("application/octet-stream")).toBe(false);
    expect(isAllowedMime("image/gif")).toBe(false);
    expect(isAllowedMime("text/html")).toBe(false);
  });
});

// Minimal PDF + PNG byte headers so file-type detects them.
const PDF_HEADER = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const PNG_HEADER = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe("validateUploadedFile", () => {
  it("rejects empty blobs", async () => {
    const result = await validateUploadedFile(new Blob([]), "application/pdf");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it("rejects oversize", async () => {
    // We don't need to actually allocate 25MB — just a Blob with oversize .size
    const bigBlob = {
      size: MAX_UPLOAD_BYTES + 1,
      slice: () => new Blob([PDF_HEADER]),
    } as unknown as Blob;
    const result = await validateUploadedFile(bigBlob, "application/pdf");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeds/i);
  });

  it("rejects disallowed declared MIMEs", async () => {
    const blob = new Blob([PDF_HEADER], { type: "image/gif" });
    const result = await validateUploadedFile(blob, "image/gif");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not accepted/i);
  });

  it("rejects content that doesn't match the declared MIME", async () => {
    const blob = new Blob([PDF_HEADER]); // bytes say PDF
    const result = await validateUploadedFile(blob, "image/png");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/does not match/i);
  });

  it("accepts a real PDF header declared as PDF", async () => {
    const blob = new Blob([PDF_HEADER]);
    const result = await validateUploadedFile(blob, "application/pdf");
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe("application/pdf");
  });

  it("accepts a real PNG header declared as PNG", async () => {
    const blob = new Blob([PNG_HEADER]);
    const result = await validateUploadedFile(blob, "image/png");
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe("image/png");
  });
});

describe("storageKey", () => {
  it("builds a study-scoped key", () => {
    const k = storageKey("study-1", "CLOSING_DISCLOSURE", "doc-1", "CD.pdf");
    expect(k).toBe("study-1/CLOSING_DISCLOSURE/doc-1-CD.pdf");
  });

  it("sanitizes filenames so the object key stays scoped", () => {
    const k = storageKey(
      "study-1",
      "PROPERTY_PHOTO",
      "doc-1",
      "../../etc/passwd photo file(1).jpg",
    );
    const prefix = "study-1/PROPERTY_PHOTO/doc-1-";
    expect(k.startsWith(prefix)).toBe(true);
    const filenamePart = k.slice(prefix.length);
    // No slashes in the filename portion — the storage key structure stays
    // {studyId}/{kind}/{documentId}-{safeFilename}.
    expect(filenamePart).not.toContain("/");
    expect(filenamePart).not.toContain(" ");
    // `..` as text in the filename is harmless (object storage doesn't
    // interpret it), but we also don't let the original `/etc/` segment
    // create a new directory level.
    expect(k).not.toContain("/etc/");
  });

  it("clamps very long filenames", () => {
    const tail = "a".repeat(500) + ".pdf";
    const k = storageKey("s", "OTHER", "d", tail);
    // key = "s/OTHER/d-" (10) + at most 120 chars of filename
    expect(k.length).toBeLessThanOrEqual(10 + 120);
  });
});
