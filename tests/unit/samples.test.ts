import { describe, expect, it } from "vitest";

import { samplePdfFilename, SAMPLE_IDS } from "@/lib/samples/catalog";

/**
 * Guards for the sample-PDF download filename. Mirrors the
 * `portfolioCsvFilename` coverage in portfolio-aggregate.test.ts so every
 * brand-keyed download has a regression test in unit-land (fast, runs on
 * every PR — no dependence on a live dev server or the workflow_dispatch
 * e2e split per ADR 0007).
 */

describe("samplePdfFilename", () => {
  it("uses the BRAND.name slug and not the legacy 'cost-seg' prefix", () => {
    for (const id of SAMPLE_IDS) {
      const filename = samplePdfFilename(id);
      expect(filename).toBe(`segra-sample-${id}.pdf`);
      expect(filename.startsWith("cost-seg-")).toBe(false);
    }
  });

  it("ends with .pdf", () => {
    expect(samplePdfFilename("oak-ridge")).toMatch(/\.pdf$/);
  });

  it("embeds the raw sample id (no slashes / transforms)", () => {
    // Sample ids are lower-kebab by convention (oak-ridge, magnolia-duplex).
    // If a future id includes unexpected characters the helper passes them
    // through verbatim — the sample catalog is the authority, not the helper.
    expect(samplePdfFilename("foo-bar-baz")).toBe("segra-sample-foo-bar-baz.pdf");
  });
});
