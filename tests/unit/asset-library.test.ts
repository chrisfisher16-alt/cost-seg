import { describe, expect, it } from "vitest";

import { getAssetLibrary } from "@/lib/ai/asset-library";
import { PROPERTY_TYPES } from "@/lib/estimator/types";

describe("asset-library", () => {
  it("loads a library for every PropertyType", () => {
    for (const pt of PROPERTY_TYPES) {
      const lib = getAssetLibrary(pt);
      expect(lib.length).toBeGreaterThan(3);
      for (const row of lib) {
        expect(row.typicalPctLow).toBeLessThanOrEqual(row.typicalPctHigh);
        expect(row.examples.length).toBeGreaterThan(5);
      }
    }
  });

  it("residential libraries use 27.5yr and commercial uses 39yr", () => {
    const str = getAssetLibrary("SHORT_TERM_RENTAL");
    const commercial = getAssetLibrary("COMMERCIAL");
    expect(str.some((c) => c.depreciationClass === "27_5yr")).toBe(true);
    expect(str.every((c) => c.depreciationClass !== "39yr")).toBe(true);
    expect(commercial.some((c) => c.depreciationClass === "39yr")).toBe(true);
  });
});
