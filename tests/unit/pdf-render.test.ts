import { describe, expect, it } from "vitest";

import { renderAiReportPdf } from "@/lib/pdf/render";
import { SAMPLE_REPORT_PROPS } from "../fixtures/sample-report-props";
import { SAMPLE_REPORT_PROPS_V2 } from "../fixtures/sample-report-props-v2";

describe("renderAiReportPdf", () => {
  it("produces a non-empty PDF for a realistic study", async () => {
    const buffer = await renderAiReportPdf(SAMPLE_REPORT_PROPS);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(10_000); // sanity: real PDFs are > 10KB
    // First bytes must be the PDF magic.
    const head = Buffer.from(buffer).subarray(0, 5).toString("ascii");
    expect(head).toBe("%PDF-");
  }, 30_000);

  it("produces a PDF for a v2 study with photo + enrichment + residual plug", async () => {
    const buffer = await renderAiReportPdf(SAMPLE_REPORT_PROPS_V2);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(10_000);
    const head = Buffer.from(buffer).subarray(0, 5).toString("ascii");
    expect(head).toBe("%PDF-");
  }, 30_000);

  // Reproduces the "unsupported number: -1.9e+21" crash observed in
  // prod v2 deliveries. Forces AssetDetailCards tall enough to cross
  // page boundaries and stresses the border/clip path that recursively
  // bit us across PRs #28/#30/#31. If this test passes, a real v2
  // delivery with 80+ items should also render clean.
  it("renders a dense v2 study (50+ items, long justifications) without pdfkit layout overflow", async () => {
    // Use realistic-length strings with actual word boundaries (repeats
    // of single x's produce a single unbreakable "word" which wraps
    // poorly and may trigger a different pathology).
    const LOREM =
      "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua Ut enim ad minim veniam ";
    const upto = (n: number) => LOREM.repeat(Math.ceil(n / LOREM.length)).slice(0, n);
    const tallItems = Array.from({ length: 80 }, (_, i) => ({
      category: i % 5 === 4 ? "27_5yr" : "5yr",
      name: `Item ${i}: stainless french-door refrigerator with ice maker`,
      amountCents: 10_000 + i,
      rationale: upto(300),
      quantity: 1,
      unit: "each",
      unitCostCents: 10_000,
      costSource: "pricesearch",
      physicalMultiplier: 0.85,
      functionalMultiplier: 0.9,
      timeMultiplier: 0.9434,
      locationMultiplier: 1.09,
      photoDataUri: SAMPLE_REPORT_PROPS_V2.schedule.lineItems[0]?.photoDataUri,
      comparableDescription: upto(250),
      physicalJustification: upto(400),
      functionalJustification: upto(400),
      timeBasis: upto(150),
      locationBasis: upto(150),
    }));
    const dense = {
      ...SAMPLE_REPORT_PROPS_V2,
      schedule: { ...SAMPLE_REPORT_PROPS_V2.schedule, lineItems: tallItems },
    } as typeof SAMPLE_REPORT_PROPS_V2;

    const buffer = await renderAiReportPdf(dense);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(10_000);
  }, 60_000);
});
