import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DOCUMENT_KIND_META, UPLOAD_WARN_AT } from "@/components/intake/meta";

/**
 * Guards the photo upload cap. v2 classifier runtime scales O(detected
 * objects) which scales linearly with photo count; past ~30 photos the
 * Opus streaming output trips platform HTTP timeouts. Cap also aligns
 * with practitioner reality for 1-unit residential/STR studies. Bumping
 * this without re-validating the classifier timeout envelope is a
 * regression — this file fails loud if someone raises it.
 */

const ACTIONS_PATH = resolve(
  __dirname,
  "..",
  "..",
  "app",
  "(app)",
  "studies",
  "[id]",
  "actions.ts",
);
const UPLOAD_ZONE_PATH = resolve(__dirname, "..", "..", "components", "intake", "UploadZone.tsx");

describe("photo upload cap", () => {
  it("PROPERTY_PHOTO meta declares maxCount=30", () => {
    expect(DOCUMENT_KIND_META.PROPERTY_PHOTO.maxCount).toBe(30);
  });

  it("soft-warn threshold is below the hard cap", () => {
    const cap = DOCUMENT_KIND_META.PROPERTY_PHOTO.maxCount!;
    expect(UPLOAD_WARN_AT).toBeLessThan(cap);
    expect(UPLOAD_WARN_AT).toBeGreaterThan(0);
  });

  it("kinds that are single-file do not declare maxCount (allowMultiple:false already caps at 1)", () => {
    expect(DOCUMENT_KIND_META.CLOSING_DISCLOSURE.maxCount).toBeUndefined();
    expect(DOCUMENT_KIND_META.APPRAISAL.maxCount).toBeUndefined();
  });

  it("createUploadUrlAction enforces the per-kind count cap server-side", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    const fn = src.match(/export\s+async\s+function\s+createUploadUrlAction[\s\S]*?^\}/m)?.[0];
    expect(fn, "createUploadUrlAction body should be findable").toBeTruthy();
    // Looks up cap from the shared meta + counts existing docs of that
    // kind + rejects past the cap. The client also blocks, but server is
    // the source of truth (racing tabs, direct action call).
    expect(fn!).toContain("DOCUMENT_KIND_META");
    expect(fn!).toContain("maxCount");
    expect(fn!).toMatch(/prisma\.document\.count/);
    expect(fn!).toMatch(/current\s*>=\s*cap/);
  });

  it("UploadZone disables the dropzone when uploaded.length >= maxCount", () => {
    const src = readFileSync(UPLOAD_ZONE_PATH, "utf8");
    expect(src).toContain("atCap");
    expect(src).toMatch(
      /meta\.maxCount\s*!==\s*undefined\s*&&\s*uploaded\.length\s*>=\s*meta\.maxCount/,
    );
  });

  it("UploadZone surfaces the approaching-cap warn state", () => {
    const src = readFileSync(UPLOAD_ZONE_PATH, "utf8");
    expect(src).toContain("UPLOAD_WARN_AT");
    expect(src).toContain("approachingCap");
  });
});
