import { describe, expect, it } from "vitest";

import { isCoordinateOverflowError, sanitizeForFallbackRender } from "@/lib/pdf/render";
import type { AiReportProps } from "@/components/pdf/AiReportTemplate";

/**
 * Covers the defensive safety net added to renderAiReportPdf after
 * multiple whack-a-mole rounds on the clipBorderTop crash class.
 */

describe("isCoordinateOverflowError", () => {
  it("matches pdfkit's unsupported-number throw verbatim", () => {
    const err = new Error("unsupported number: -1.939889792167799e+21");
    expect(isCoordinateOverflowError(err)).toBe(true);
  });

  it("matches the message regardless of the exact numeric value", () => {
    expect(isCoordinateOverflowError(new Error("unsupported number: 2.1e22"))).toBe(true);
    expect(isCoordinateOverflowError(new Error("Unsupported number: -5e40"))).toBe(true);
  });

  it("does not match unrelated errors", () => {
    expect(isCoordinateOverflowError(new Error("ECONNREFUSED"))).toBe(false);
    expect(isCoordinateOverflowError(new Error("Out of memory"))).toBe(false);
    expect(isCoordinateOverflowError(null)).toBe(false);
    expect(isCoordinateOverflowError(undefined)).toBe(false);
  });
});

describe("sanitizeForFallbackRender", () => {
  const base = {
    studyId: "s1",
    generatedAt: new Date("2026-04-24T00:00:00Z"),
    tierLabel: "AI Report",
    property: {
      address: "1 Test St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      propertyTypeLabel: "SHORT_TERM_RENTAL",
      acquiredAtIso: "2024-01-01",
      heroPhotoDataUri: "data:image/jpeg;base64,ABC",
    },
    decomposition: {
      purchasePriceCents: 50_000_00,
      landValueCents: 10_000_00,
      buildingValueCents: 40_000_00,
      landAllocationPct: 0.2,
      methodology: "test",
      confidence: 0.9,
    },
    narrative: {
      executiveSummary: "x",
      propertyDescription: "x",
      methodology: "x",
      assetScheduleExplanation: "x",
      scheduleSummaryTable: "x",
    },
    schedule: {
      lineItems: [
        {
          category: "5yr" as const,
          name: "x".repeat(200),
          amountCents: 1000_00,
          rationale: "y".repeat(400),
          photoDataUri: "data:image/jpeg;base64,XYZ",
          comparableDescription: "z".repeat(500),
          physicalJustification: "p".repeat(500),
          functionalJustification: "f".repeat(500),
          timeBasis: "t".repeat(500),
          locationBasis: "l".repeat(500),
        },
      ],
      groups: [],
      totalCents: 1000_00,
    },
    projection: {
      bonusEligibleCents: 0,
      residentialCents: 0,
      commercialCents: 0,
    },
    assumedBracket: 0.32,
  } as unknown as AiReportProps;

  it("drops inlined photo data URIs (line item + cover hero)", () => {
    const out = sanitizeForFallbackRender(base);
    expect(out.schedule.lineItems[0]!.photoDataUri).toBeUndefined();
    expect(out.property.heroPhotoDataUri).toBeNull();
  });

  it("truncates long text fields that drive card-height variance", () => {
    const out = sanitizeForFallbackRender(base);
    const item = out.schedule.lineItems[0]!;
    expect(item.name.length).toBeLessThanOrEqual(140);
    expect(item.rationale.length).toBeLessThanOrEqual(200);
    expect(item.comparableDescription!.length).toBeLessThanOrEqual(200);
    expect(item.physicalJustification!.length).toBeLessThanOrEqual(240);
    expect(item.functionalJustification!.length).toBeLessThanOrEqual(240);
  });

  it("preserves every dollar figure unchanged", () => {
    const out = sanitizeForFallbackRender(base);
    expect(out.schedule.lineItems[0]!.amountCents).toBe(1000_00);
    expect(out.decomposition.purchasePriceCents).toBe(50_000_00);
    expect(out.decomposition.buildingValueCents).toBe(40_000_00);
    expect(out.schedule.totalCents).toBe(1000_00);
  });
});
