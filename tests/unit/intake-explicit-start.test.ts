import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Regression for the intake "explicit start" fix.
 *
 * Before this change, every document upload and every property save called
 * `emitDocumentsReadyIfComplete` — so the pipeline auto-fired the instant the
 * minimum required docs were present. Inngest's `process-study` snapshots the
 * document list at its `load-study` step, which meant any file uploaded AFTER
 * autostart was silently ignored.
 *
 * The fix: uploads no longer call the ready-check; a new `startPipelineAction`
 * is the single entry point, wired to an explicit "Start my report" button in
 * the intake sidebar.
 *
 * These are structural assertions (not behavioral mocks) so the regression
 * guard is cheap and catches a future accidental re-introduction at review
 * time rather than in production.
 */

const ACTIONS_PATH = resolve(
  __dirname,
  "..",
  "..",
  "app",
  "(app)",
  "studies",
  "[id]",
  "actions.ts",
);
const INTAKE_PAGE_PATH = resolve(
  __dirname,
  "..",
  "..",
  "app",
  "(app)",
  "studies",
  "[id]",
  "intake",
  "page.tsx",
);
const START_BUTTON_PATH = resolve(
  __dirname,
  "..",
  "..",
  "components",
  "intake",
  "IntakeStartButton.tsx",
);

describe("intake explicit start (no autostart)", () => {
  const actionsSrc = readFileSync(ACTIONS_PATH, "utf8");

  it("exports startPipelineAction", () => {
    expect(actionsSrc).toMatch(/export\s+async\s+function\s+startPipelineAction/);
  });

  it("startPipelineAction calls emitDocumentsReadyIfComplete", () => {
    const startFn = actionsSrc.match(
      /export\s+async\s+function\s+startPipelineAction[\s\S]*?^\}/m,
    )?.[0];
    expect(startFn, "startPipelineAction body should be findable").toBeTruthy();
    expect(startFn!).toContain("emitDocumentsReadyIfComplete(studyId)");
  });

  it("startPipelineAction treats a prior documents.ready event as success (idempotent re-click)", () => {
    const startFn = actionsSrc.match(
      /export\s+async\s+function\s+startPipelineAction[\s\S]*?^\}/m,
    )?.[0];
    expect(startFn, "startPipelineAction body should be findable").toBeTruthy();
    // The pre-emit guard: findFirst on StudyEvent with kind "documents.ready".
    expect(startFn!).toMatch(/studyEvent\.findFirst/);
    expect(startFn!).toContain('kind: "documents.ready"');
    // And when it finds one, the action must return ok: true — NOT the
    // "Could not start the pipeline" error. We assert textually because
    // the behavior-level check was flagged in production: customer hit a
    // scary error on a re-click that should have been a no-op.
    // The `if (prior)` branch must return `ok: true` — confirm the
    // `if (prior)` condition is followed by an `ok: true` return before
    // any other return statement appears, so a re-click is a no-op.
    expect(startFn!).toMatch(/if\s*\(\s*prior\s*\)[\s\S]*?return\s*\{\s*ok:\s*true/);
  });

  it("updatePropertyAction does NOT call emitDocumentsReadyIfComplete", () => {
    const updateFn = actionsSrc.match(
      /export\s+async\s+function\s+updatePropertyAction[\s\S]*?^\}/m,
    )?.[0];
    expect(updateFn, "updatePropertyAction body should be findable").toBeTruthy();
    expect(updateFn!).not.toContain("emitDocumentsReadyIfComplete");
  });

  it("finalizeUploadAction does NOT call emitDocumentsReadyIfComplete", () => {
    const finalizeFn = actionsSrc.match(
      /export\s+async\s+function\s+finalizeUploadAction[\s\S]*?^\}/m,
    )?.[0];
    expect(finalizeFn, "finalizeUploadAction body should be findable").toBeTruthy();
    expect(finalizeFn!).not.toContain("emitDocumentsReadyIfComplete");
  });

  it("IntakeStartButton client component exists and wires startPipelineAction", () => {
    const src = readFileSync(START_BUTTON_PATH, "utf8");
    expect(src.startsWith('"use client"')).toBe(true);
    expect(src).toContain("startPipelineAction");
    expect(src).toContain("Start my report");
  });

  it("intake page renders IntakeStartButton only when complete && !processing && !locked", () => {
    const src = readFileSync(INTAKE_PAGE_PATH, "utf8");
    expect(src).toContain("IntakeStartButton");
    // The gating condition must be present verbatim — if any of the three
    // checks drops, the button would render in the wrong state.
    expect(src).toMatch(/completeness\.complete\s*&&\s*!processing\s*&&\s*!locked/);
  });
});
