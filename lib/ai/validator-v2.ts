import type { AssetLineItemV2, ClassifyAssetsV2Output } from "@/lib/ai/prompts/classify-assets-v2";

/**
 * v2 validator (Phase 2). The v1 validator (`lib/ai/validator.ts`) enforces
 * "line items sum to exactly building value" — the v2 schema uses a
 * residual plug instead, so the invariants are different:
 *
 *   1. Exactly one line item has `isResidual=true`.
 *   2. Every non-residual line's `adjustedCostCents` matches
 *      round(quantity × unitCost × physical × functional × time × location)
 *      within ±$0.05.
 *   3. Σ non-residual adjustedCostCents ≤ buildingValueCents
 *      (otherwise the residual would be negative).
 *   4. source ∈ { pricesearch, receipt } — craftsman/rsmeans are
 *      schema-legal but policy-forbidden pending Phase 3 (ADR 0009).
 *   5. Receipt-sourced lines have all six multipliers = 1.0000.
 */

/** Cents tolerance on the per-line adjusted-cost arithmetic check. */
export const ARITHMETIC_TOLERANCE_CENTS = 5;

/** Allowed cost-source values on the current prompt. Schema allows more; policy doesn't. */
export const ALLOWED_COST_SOURCES = new Set(["pricesearch", "receipt"]);

export interface ValidateV2Result {
  ok: boolean;
  residualCents: number;
  nonResidualSumCents: number;
  expectedCents: number;
  issues: string[];
  message?: string;
}

function computeExpectedAdjustedCost(line: AssetLineItemV2): number {
  const raw =
    line.quantity *
    line.comparable.unitCostCents *
    line.physicalMultiplier *
    line.functionalMultiplier *
    line.timeMultiplier *
    line.locationMultiplier;
  return Math.round(raw);
}

function allMultipliersOne(line: AssetLineItemV2): boolean {
  const epsilon = 1e-4;
  return (
    Math.abs(line.physicalMultiplier - 1) < epsilon &&
    Math.abs(line.functionalMultiplier - 1) < epsilon &&
    Math.abs(line.timeMultiplier - 1) < epsilon &&
    Math.abs(line.locationMultiplier - 1) < epsilon
  );
}

export function validateClassifyAssetsV2(
  schedule: ClassifyAssetsV2Output,
  expectedCents: number,
): ValidateV2Result {
  const issues: string[] = [];

  const residuals = schedule.lineItems.filter((li) => li.isResidual === true);
  if (residuals.length === 0) {
    issues.push("Missing residual line: exactly one line item must have isResidual=true.");
  } else if (residuals.length > 1) {
    issues.push(
      `Too many residual lines: expected exactly one isResidual=true line, got ${residuals.length}.`,
    );
  }

  const nonResidual = schedule.lineItems.filter((li) => li.isResidual !== true);

  for (const [idx, line] of nonResidual.entries()) {
    // Policy: craftsman/rsmeans disallowed in current prompt rev.
    if (!ALLOWED_COST_SOURCES.has(line.source)) {
      issues.push(
        `Line ${idx + 1} ("${line.name}"): source="${line.source}" is not allowed — use "receipt" for receipt-sourced items and "pricesearch" for photo-estimated items.`,
      );
    }
    // Arithmetic check.
    const expected = computeExpectedAdjustedCost(line);
    const diff = Math.abs(line.adjustedCostCents - expected);
    if (diff > ARITHMETIC_TOLERANCE_CENTS) {
      issues.push(
        `Line ${idx + 1} ("${line.name}"): adjustedCostCents=${line.adjustedCostCents} but quantity×unitCost×multipliers rounds to ${expected}. Off by ${diff} cents.`,
      );
    }
    // Receipt lines must have pass-through multipliers.
    if (line.source === "receipt" && !allMultipliersOne(line)) {
      issues.push(
        `Line ${idx + 1} ("${line.name}"): source="receipt" requires all six multipliers to equal 1.0000 (receipt cost passes through unchanged).`,
      );
    }
    // Receipt lines never carry a retailer URL — the receipt IS the source.
    if (line.source === "receipt" && line.comparable.sourceUrl) {
      issues.push(
        `Line ${idx + 1} ("${line.name}"): source="receipt" must not include comparable.sourceUrl.`,
      );
    }
  }

  const nonResidualSumCents = nonResidual.reduce((acc, li) => acc + li.adjustedCostCents, 0);
  const residualCents = expectedCents - nonResidualSumCents;
  if (residualCents < 0) {
    issues.push(
      `Non-residual line items sum to ${nonResidualSumCents} cents, which exceeds the building value of ${expectedCents} cents by ${Math.abs(residualCents)} cents. Reduce quantities or cost estimates so the residual is non-negative.`,
    );
  }

  const ok = issues.length === 0;
  return {
    ok,
    residualCents,
    nonResidualSumCents,
    expectedCents,
    issues,
    message: ok ? undefined : issues.join(" "),
  };
}

export function formatV2ValidationErrorForRetry(result: ValidateV2Result): string {
  if (result.ok) return "";
  return result.message ?? "Schedule failed v2 validation.";
}

/**
 * Apply the residual plug: overwrite the residual line's
 * adjustedCostCents with the difference between building value and the
 * sum of non-residual adjusted costs. Does not mutate input; returns a
 * new schedule with the residual updated.
 *
 * Caller must validate first — this does NOT check for a negative
 * residual or missing residual line.
 */
export function applyResidualPlug(
  schedule: ClassifyAssetsV2Output,
  buildingValueCents: number,
): ClassifyAssetsV2Output {
  const nonResidualSum = schedule.lineItems
    .filter((li) => li.isResidual !== true)
    .reduce((acc, li) => acc + li.adjustedCostCents, 0);
  const residualCents = buildingValueCents - nonResidualSum;
  return {
    ...schedule,
    lineItems: schedule.lineItems.map((li) => {
      if (li.isResidual !== true) return li;
      return {
        ...li,
        adjustedCostCents: residualCents,
        comparable: { ...li.comparable, unitCostCents: residualCents },
      };
    }),
  };
}

/** Total adjusted cost across ALL line items (including residual). */
export function totalAdjustedCostCents(schedule: ClassifyAssetsV2Output): number {
  return schedule.lineItems.reduce((acc, li) => acc + li.adjustedCostCents, 0);
}
