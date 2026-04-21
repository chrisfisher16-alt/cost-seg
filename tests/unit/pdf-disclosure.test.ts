import { describe, expect, it } from "vitest";

import { TIER_1_SCOPE_DISCLOSURE } from "@/lib/pdf/disclosure";
import { SCOPE_DISCLOSURE_SHORT } from "@/lib/pdf/disclosure-short";

// Spot-check that the verbatim legal language from master prompt §8 has not
// drifted. If this test fails and the change is intentional, re-read §8
// (and the ADR hierarchy around legal posture) before adjusting the string.
describe("TIER_1_SCOPE_DISCLOSURE", () => {
  it("opens with the canonical heading", () => {
    expect(TIER_1_SCOPE_DISCLOSURE.startsWith("Important scope disclosure.")).toBe(true);
  });

  it("cites Publication 5653 by number", () => {
    expect(TIER_1_SCOPE_DISCLOSURE).toContain("Publication 5653");
  });

  it("forbids filing without CPA review", () => {
    expect(TIER_1_SCOPE_DISCLOSURE).toMatch(/without your CPA/i);
  });

  it("offers the upgrade path", () => {
    expect(TIER_1_SCOPE_DISCLOSURE).toMatch(/Engineer-Reviewed tier/i);
  });

  it("explicitly states not-a-complete-study", () => {
    expect(TIER_1_SCOPE_DISCLOSURE).toMatch(/not a complete cost segregation study/i);
  });
});

// Pre-purchase / pre-delivery disclosure. Same material claims as the PDF
// footer, minus the delivery-artifact-specific "not signed by a PE" +
// "upgrade to Tier 2" lines. See lib/pdf/disclosure-short.ts for the
// rationale. Required substrings match what a CPA reading the estimator
// or welcome email is entitled to be told.
describe("SCOPE_DISCLOSURE_SHORT", () => {
  it("explicitly states this is software-produced", () => {
    expect(SCOPE_DISCLOSURE_SHORT).toMatch(/produced by software/i);
  });

  it("cites Publication 5653 by number", () => {
    expect(SCOPE_DISCLOSURE_SHORT).toContain("Publication 5653");
  });

  it("says 'not a complete cost segregation study'", () => {
    expect(SCOPE_DISCLOSURE_SHORT).toMatch(/not a complete cost segregation study/i);
  });

  it("requires independent CPA review", () => {
    expect(SCOPE_DISCLOSURE_SHORT).toMatch(/without your CPA/i);
  });

  it("does NOT include the PDF-only 'not signed by a PE' line", () => {
    // That line belongs on the delivered PDF only; on pre-purchase surfaces
    // it's redundant with the pricing page's tier breakdown.
    expect(SCOPE_DISCLOSURE_SHORT).not.toMatch(/professional engineer/i);
  });

  it("does NOT include the PDF-only 'upgrade to Engineer-Reviewed' upsell", () => {
    // Marketing uses PricingSection for the upsell; the welcome email has
    // its own tailored upsell line following this disclosure.
    expect(SCOPE_DISCLOSURE_SHORT).not.toMatch(/Engineer-Reviewed tier/i);
  });
});
