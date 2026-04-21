import { describe, expect, it } from "vitest";

import {
  DECOMPOSE_PRICE_PROMPT_VERSION,
  DECOMPOSE_PRICE_SYSTEM,
  buildDecomposePriceUserPrompt,
} from "@/lib/ai/prompts/decompose-price";

/**
 * v2 Phase 4 prompt changes — the system prompt now carries a strict
 * rule order where rule #2 (assessor ratio) wins over rule #3 (market
 * range). The user-prompt builder threads enrichment through when it
 * has an assessor pair, and flags a partial / missing enrichment so the
 * model knows to fall through.
 */

describe("decompose-price prompt (v2)", () => {
  it("bumps the prompt version to v2", () => {
    expect(DECOMPOSE_PRICE_PROMPT_VERSION).toBe("decompose-price@v2");
  });

  it("system prompt encodes the assessor-ratio rule + URL citation requirement", () => {
    expect(DECOMPOSE_PRICE_SYSTEM).toMatch(/strict order/i);
    expect(DECOMPOSE_PRICE_SYSTEM).toMatch(
      /assessor[lL]andValueCents \/ assessor[tT]otalValueCents/,
    );
    expect(DECOMPOSE_PRICE_SYSTEM).toMatch(/cite the assessor url/i);
  });

  it("user prompt surfaces assessor block when both land + total are present", () => {
    const text = buildDecomposePriceUserPrompt({
      propertyType: "SINGLE_FAMILY_RENTAL",
      address: "207 S Edison",
      closingDisclosureFields: { purchasePriceCents: 39_350_300 },
      enrichment: {
        assessorLandValueCents: 15_508_000,
        assessorTotalValueCents: 53_600_000,
        assessorTaxYear: 2022,
        assessorUrl: "https://gillespiecad.org/property/R012345",
      },
    });
    expect(text).toMatch(/County assessor record/);
    expect(text).toContain("15508000");
    expect(text).toContain("53600000");
    expect(text).toMatch(/apply rule 2/i);
  });

  it("user prompt prints a fall-through hint when enrichment ran but lacks a full pair", () => {
    const text = buildDecomposePriceUserPrompt({
      propertyType: "SINGLE_FAMILY_RENTAL",
      address: "1 Foo",
      closingDisclosureFields: {},
      enrichment: { assessorLandValueCents: 100_000 }, // total missing
    });
    expect(text).toMatch(/did not return a complete assessor land\+total pair/i);
    expect(text).not.toMatch(/apply rule 2/i);
  });

  it("user prompt stays backwards-compatible when no enrichment is supplied", () => {
    const text = buildDecomposePriceUserPrompt({
      propertyType: "COMMERCIAL",
      address: "1 Foo",
      closingDisclosureFields: { purchasePriceCents: 100 },
    });
    expect(text).not.toMatch(/County assessor record/);
    expect(text).not.toMatch(/fall through to rule 3/i);
    expect(text).toContain("Produce the land / building decomposition.");
  });

  it("zero assessor total counts as missing (avoids divide-by-zero in rule 2)", () => {
    const text = buildDecomposePriceUserPrompt({
      propertyType: "COMMERCIAL",
      address: "1 Foo",
      closingDisclosureFields: {},
      enrichment: { assessorLandValueCents: 100, assessorTotalValueCents: 0 },
    });
    expect(text).toMatch(/did not return a complete assessor land\+total pair/i);
  });
});
