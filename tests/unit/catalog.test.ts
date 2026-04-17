import { describe, expect, it } from "vitest";
import { CATALOG, formatCents } from "@/lib/stripe/catalog";

describe("stripe catalog", () => {
  it("prices Tier 1 at $295", () => {
    expect(CATALOG.AI_REPORT.priceCents).toBe(29500);
    expect(formatCents(CATALOG.AI_REPORT.priceCents)).toBe("$295");
  });

  it("prices Tier 2 at $1,495", () => {
    expect(CATALOG.ENGINEER_REVIEWED.priceCents).toBe(149500);
    expect(formatCents(CATALOG.ENGINEER_REVIEWED.priceCents)).toBe("$1,495");
  });
});
