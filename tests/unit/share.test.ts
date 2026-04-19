import { describe, expect, it } from "vitest";

import { buildShareUrl } from "@/lib/studies/share";

describe("buildShareUrl", () => {
  it("concatenates the token onto the app origin", () => {
    expect(buildShareUrl("abc123", "https://costseg.app")).toBe("https://costseg.app/share/abc123");
  });

  it("strips a trailing slash from the app URL to avoid double slashes", () => {
    expect(buildShareUrl("abc123", "https://costseg.app/")).toBe(
      "https://costseg.app/share/abc123",
    );
  });

  it("handles localhost in dev", () => {
    expect(buildShareUrl("tok", "http://localhost:3000")).toBe("http://localhost:3000/share/tok");
  });
});
