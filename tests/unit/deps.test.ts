import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

/**
 * Guards that ADR 0006 stays honored at the dependency level.
 *
 * ADR 0006 ("Claude reads PDFs directly; Textract deferred") says V1 never
 * imports AWS Textract. The live codebase never imported the SDK, but it was
 * sitting in `dependencies` as a 75-package subtree (weighing every install
 * + lockfile update). More importantly: re-adding it would need an explicit
 * ADR revision, not a silent `pnpm add`. This test fires before that slips
 * back in.
 */

const ALL_DEPS = {
  ...("dependencies" in packageJson ? (packageJson.dependencies as Record<string, string>) : {}),
  ...("devDependencies" in packageJson
    ? (packageJson.devDependencies as Record<string, string>)
    : {}),
} as const;

describe("package.json dep guardrails (ADR 0006)", () => {
  it("does not declare @aws-sdk/client-textract — we use Claude vision instead", () => {
    expect(ALL_DEPS).not.toHaveProperty("@aws-sdk/client-textract");
  });

  it("does not declare any @aws-sdk/* package — nothing here needs AWS SDKs", () => {
    const awsSdkPackages = Object.keys(ALL_DEPS).filter((name) => name.startsWith("@aws-sdk/"));
    expect(
      awsSdkPackages,
      `Unexpected @aws-sdk/* packages in package.json: ${awsSdkPackages.join(", ")}. ` +
        `If an AWS dependency is truly needed, update docs/adr/0006-claude-pdf-over-textract.md first.`,
    ).toEqual([]);
  });
});
