import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression coverage for the dashboard filter tabs and the per-study
 * Delete button the operator asked for after the beta went live.
 *
 * These are structural assertions — each guards a specific decision we
 * made so a later refactor can't silently regress them:
 *
 *   1. `deleteStudyAction` refuses to delete PROCESSING studies (Inngest
 *      is actively working the pipeline and cascading the Study row out
 *      from under it would leave orphaned steps).
 *   2. `deleteStudyAction` revalidates `/dashboard` so the list reflects
 *      the deletion on the next render.
 *   3. Dashboard `filter` query parameter parses to one of three known
 *      values; anything else falls back to `all`.
 *   4. The dashboard renders the `DeleteStudyButton` on every card.
 */

const REPO_ROOT = resolve(__dirname, "..", "..");
const ACTIONS_PATH = resolve(REPO_ROOT, "app", "(app)", "studies", "[id]", "actions.ts");
const DASHBOARD_PATH = resolve(REPO_ROOT, "app", "(app)", "dashboard", "page.tsx");
const DELETE_BUTTON_PATH = resolve(REPO_ROOT, "components", "app", "DeleteStudyButton.tsx");

describe("dashboard — delete + filter", () => {
  it("deleteStudyAction blocks PROCESSING studies", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    const fn = src.match(/export\s+async\s+function\s+deleteStudyAction[\s\S]*?^\}/m)?.[0];
    expect(fn, "deleteStudyAction should be exported").toBeTruthy();
    expect(fn!).toMatch(/status\s*===\s*"PROCESSING"/);
    // Must surface a user-facing error, not just return silently.
    expect(fn!).toMatch(/error:\s*"[^"]*processing[^"]*"/i);
  });

  it("deleteStudyAction revalidates /dashboard", () => {
    const src = readFileSync(ACTIONS_PATH, "utf8");
    const fn = src.match(/export\s+async\s+function\s+deleteStudyAction[\s\S]*?^\}/m)?.[0];
    expect(fn!).toMatch(/revalidatePath\(\s*"\/dashboard"\s*\)/);
  });

  it("dashboard parseFilter coerces unknown values to 'all'", () => {
    const src = readFileSync(DASHBOARD_PATH, "utf8");
    const fn = src.match(/function\s+parseFilter[\s\S]*?^\}/m)?.[0];
    expect(fn, "parseFilter helper should exist").toBeTruthy();
    // The two known values must each appear in the body.
    expect(fn!).toContain('"in-progress"');
    expect(fn!).toContain('"delivered"');
    // Default branch returns "all".
    expect(fn!).toMatch(/return\s+"all"/);
  });

  it("dashboard filter sees the `filter` searchParam", () => {
    const src = readFileSync(DASHBOARD_PATH, "utf8");
    expect(src).toMatch(/parseFilter\(\s*params\.filter\s*\)/);
  });

  it("dashboard renders DeleteStudyButton on each study card", () => {
    const src = readFileSync(DASHBOARD_PATH, "utf8");
    expect(src).toContain("import { DeleteStudyButton }");
    // Button must appear inside the StudyCard component body — grep for the
    // tag preceded by no closing `function` between the StudyCard start
    // and the usage.
    const cardMatch = src.match(/function\s+StudyCard[\s\S]*?^\}/m);
    expect(cardMatch, "StudyCard body should be findable").toBeTruthy();
    expect(cardMatch![0]).toContain("<DeleteStudyButton");
  });

  it("DeleteStudyButton client component uses a confirmation dialog", () => {
    const src = readFileSync(DELETE_BUTTON_PATH, "utf8");
    expect(src.startsWith('"use client"')).toBe(true);
    expect(src).toContain("deleteStudyAction");
    // Confirmation dialog — Delete permanently is destructive, a single-click
    // fire would eat data silently.
    expect(src).toContain("DialogTrigger");
    expect(src).toContain("DialogContent");
    expect(src).toMatch(/Delete permanently|can.t undo/i);
  });
});
