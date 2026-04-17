import { describe, expect, it } from "vitest";

import { scrubPii, scrubPiiJson } from "@/lib/ai/scrub";

describe("scrubPii", () => {
  it("redacts a dashed SSN", () => {
    expect(scrubPii("John Doe SSN 123-45-6789 is on file")).toBe(
      "John Doe SSN [REDACTED]:SSN is on file",
    );
  });

  it("redacts bank / routing numbers when labeled", () => {
    const input = "Routing Number: 026009593 and Account No. 1234567890";
    const out = scrubPii(input);
    expect(out).not.toContain("026009593");
    expect(out).not.toContain("1234567890");
    expect(out).toContain("[REDACTED]:BANK");
  });

  it("redacts DOB near keyword", () => {
    const input = "DOB 01/02/1980 — buyer";
    expect(scrubPii(input)).toContain("[REDACTED]:DOB");
  });

  it("redacts credit-card-shaped numbers", () => {
    const input = "On file: 4111 1111 1111 1111";
    const out = scrubPii(input);
    expect(out).toContain("[REDACTED]:CARD");
  });

  it("leaves normal dollar amounts alone", () => {
    expect(scrubPii("Purchase price: $425,000.00")).toBe("Purchase price: $425,000.00");
  });

  it("round-trips JSON structures", () => {
    const input = { owner: "A. Buyer", ssn: "123-45-6789", price: 425000 };
    const out = scrubPiiJson(input);
    expect(out.owner).toBe("A. Buyer");
    expect(out.price).toBe(425000);
    expect(String(out.ssn)).toContain("[REDACTED]");
  });
});
