import { describe, expect, it } from "vitest";

import { decodeCheckoutMetadata, encodeCheckoutMetadata } from "@/lib/stripe/checkout";

describe("encodeCheckoutMetadata", () => {
  it("round-trips a minimal payload", () => {
    const input = {
      tier: "AI_REPORT",
      propertyType: "SHORT_TERM_RENTAL",
    } as const;
    const encoded = encodeCheckoutMetadata(input);
    expect(encoded).toEqual({
      tier: "AI_REPORT",
      propertyType: "SHORT_TERM_RENTAL",
    });
    expect(decodeCheckoutMetadata(encoded)).toEqual(input);
  });

  it("round-trips a full payload and clamps long addresses", () => {
    const longAddress = "a".repeat(600);
    const encoded = encodeCheckoutMetadata({
      tier: "ENGINEER_REVIEWED",
      propertyType: "COMMERCIAL",
      userId: "abc-123",
      addressLine: longAddress,
      purchasePriceCents: "12500000",
    });
    expect(encoded.addressLine?.length).toBe(480);
    const decoded = decodeCheckoutMetadata(encoded);
    expect(decoded).toMatchObject({
      tier: "ENGINEER_REVIEWED",
      propertyType: "COMMERCIAL",
      userId: "abc-123",
      purchasePriceCents: "12500000",
    });
  });

  it("rejects unknown tier", () => {
    expect(decodeCheckoutMetadata({ tier: "FREE", propertyType: "SHORT_TERM_RENTAL" })).toBeNull();
  });

  it("rejects unknown property type", () => {
    expect(decodeCheckoutMetadata({ tier: "AI_REPORT", propertyType: "YACHT" })).toBeNull();
  });

  it("returns null for null input", () => {
    expect(decodeCheckoutMetadata(null)).toBeNull();
  });
});
