import { describe, expect, it } from "vitest";

import { TIER_1_SCOPE_DISCLOSURE } from "@/lib/pdf/disclosure";

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
