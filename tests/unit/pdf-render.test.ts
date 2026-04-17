import { describe, expect, it } from "vitest";

import { renderAiReportPdf } from "@/lib/pdf/render";
import { SAMPLE_REPORT_PROPS } from "../fixtures/sample-report-props";

describe("renderAiReportPdf", () => {
  it("produces a non-empty PDF for a realistic study", async () => {
    const buffer = await renderAiReportPdf(SAMPLE_REPORT_PROPS);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(10_000); // sanity: real PDFs are > 10KB
    // First bytes must be the PDF magic.
    const head = Buffer.from(buffer).subarray(0, 5).toString("ascii");
    expect(head).toBe("%PDF-");
  }, 30_000);
});
