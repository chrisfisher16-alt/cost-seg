import { describe, expect, it } from "vitest";

import { classifyShareError } from "@/lib/studies/share-error";

describe("classifyShareError", () => {
  it("maps 'Share link not found.' to the not-found kind with dashboard recovery", () => {
    const r = classifyShareError(new Error("Share link not found."));
    expect(r.kind).toBe("not-found");
    expect(r.title).toMatch(/doesn't work/i);
    expect(r.hint).toMatch(/fresh invite/i);
    expect(r.recoveryHref).toBe("/dashboard");
  });

  it("maps 'This invitation has been revoked.' to revoked", () => {
    const r = classifyShareError(new Error("This invitation has been revoked."));
    expect(r.kind).toBe("revoked");
    expect(r.title).toMatch(/revoked/i);
    expect(r.hint).toMatch(/re-share/i);
  });

  it("maps 'different account' to wrong-account with a sign-out recovery", () => {
    const r = classifyShareError(
      new Error("This invitation was already accepted by a different account."),
    );
    expect(r.kind).toBe("wrong-account");
    expect(r.recoveryLabel).toMatch(/sign out/i);
    expect(r.recoveryHref).toContain("signout=1");
    expect(r.hint).toMatch(/exact email/i);
  });

  it("maps 'Invalid email address.' to invalid-email", () => {
    const r = classifyShareError(new Error("Invalid email address."));
    expect(r.kind).toBe("invalid-email");
    expect(r.hint).toMatch(/valid email/i);
  });

  it("falls through to generic with the original message passed along", () => {
    const r = classifyShareError(new Error("Database timeout acquiring connection."));
    expect(r.kind).toBe("generic");
    expect(r.hint).toContain("Database timeout");
  });

  it("uses a friendly fallback hint when the message is empty", () => {
    const r = classifyShareError(new Error(""));
    expect(r.kind).toBe("generic");
    expect(r.hint).toContain("support@costseg.app");
  });

  it("accepts plain strings and non-Error objects without crashing", () => {
    expect(() => classifyShareError("Share link not found.")).not.toThrow();
    expect(() => classifyShareError({ message: "revoked" })).not.toThrow();
    expect(classifyShareError("Share link not found.").kind).toBe("not-found");
    expect(classifyShareError({ message: "This invitation has been revoked." }).kind).toBe(
      "revoked",
    );
  });

  it("survives null / undefined / numeric inputs", () => {
    expect(classifyShareError(null).kind).toBe("generic");
    expect(classifyShareError(undefined).kind).toBe("generic");
    expect(classifyShareError(42).kind).toBe("generic");
  });

  it("is case-insensitive on the distinguishing phrases", () => {
    expect(classifyShareError(new Error("SHARE LINK NOT FOUND")).kind).toBe("not-found");
    expect(classifyShareError(new Error("REVOKED!")).kind).toBe("revoked");
  });
});
