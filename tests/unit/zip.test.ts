import { describe, expect, it } from "vitest";

import { isValidZip, zipHint } from "@/lib/estimator/zip";

describe("zipHint", () => {
  it("treats empty input as empty, not invalid", () => {
    expect(zipHint("").kind).toBe("empty");
    expect(zipHint("   ").kind).toBe("empty");
  });

  it("does not flash 'invalid' while the user is still typing digits", () => {
    expect(zipHint("9").kind).toBe("partial");
    expect(zipHint("94").kind).toBe("partial");
    expect(zipHint("941").kind).toBe("partial");
    expect(zipHint("9411").kind).toBe("partial");
  });

  it("accepts the 5-digit ZIP", () => {
    expect(zipHint("94110").kind).toBe("valid");
    expect(zipHint("00501").kind).toBe("valid"); // Holtsville NY, valid edge
  });

  it("accepts the ZIP+4 format", () => {
    expect(zipHint("94110-1234").kind).toBe("valid");
  });

  it("holds partial when user has typed the dash but not the +4 yet", () => {
    expect(zipHint("94110-").kind).toBe("partial");
    expect(zipHint("94110-1").kind).toBe("partial");
    expect(zipHint("94110-12").kind).toBe("partial");
  });

  it("rejects letters with specific copy", () => {
    const r = zipHint("94A10");
    expect(r.kind).toBe("invalid");
    expect(r.message).toContain("digits only");
  });

  it("rejects too-many-digits with specific copy", () => {
    const r = zipHint("941100");
    expect(r.kind).toBe("invalid");
    expect(r.message).toContain("6 digits");
  });

  it("rejects malformed ZIP+4", () => {
    expect(zipHint("94110-12345").kind).toBe("invalid");
    expect(zipHint("94110--1234").kind).toBe("invalid");
    expect(zipHint("-1234").kind).toBe("invalid");
  });

  it("never returns message for partial or valid", () => {
    expect(zipHint("941").message).toBeNull();
    expect(zipHint("94110").message).toBeNull();
  });
});

describe("isValidZip", () => {
  it("returns true for 5-digit ZIPs", () => {
    expect(isValidZip("94110")).toBe(true);
  });

  it("returns true for ZIP+4", () => {
    expect(isValidZip("94110-1234")).toBe(true);
  });

  it("returns false for partial or malformed input", () => {
    expect(isValidZip("9411")).toBe(false);
    expect(isValidZip("94110-")).toBe(false);
    expect(isValidZip("94110-12")).toBe(false);
    expect(isValidZip("ABCDE")).toBe(false);
    expect(isValidZip("")).toBe(false);
  });

  it("trims surrounding whitespace before checking", () => {
    expect(isValidZip("  94110  ")).toBe(true);
  });
});
