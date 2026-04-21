import { describe, expect, it } from "vitest";

import { DEFAULT_RASTERIZE_DPI, rasterizePdfToPngs, __testing } from "@/lib/pdf/rasterize";

/**
 * v2 Phase 7b slice 2 — rasterize helper.
 *
 * The helper dynamically imports `pdf-to-png-converter` at runtime so
 * the dep doesn't have to ship in package.json. The actual rasterizer
 * is exercised in manual QA against real v2 PDFs; the unit test here
 * verifies the **missing-dep fallback** — calling the helper without
 * the dep installed must throw a clear, actionable error.
 */

describe("rasterizePdfToPngs", () => {
  it("exposes a 150 DPI default matching the Phase 7b spec", () => {
    expect(DEFAULT_RASTERIZE_DPI).toBe(150);
  });

  it("throws a helpful error when pdf-to-png-converter is not installed", async () => {
    await expect(rasterizePdfToPngs(Buffer.from("%PDF-fake"), { dpi: 72 })).rejects.toThrow(
      /not installed/i,
    );
  });

  it("error message includes the install command so ops can act without reading the stack", async () => {
    await expect(rasterizePdfToPngs(Buffer.from("%PDF-fake"))).rejects.toThrow(
      /pnpm add pdf-to-png-converter/i,
    );
  });

  it("exports the missing-dep template for reuse in other error surfaces", () => {
    expect(__testing.MISSING_DEP_MESSAGE).toMatch(/V2_REPORT_REVIEW/);
  });
});
