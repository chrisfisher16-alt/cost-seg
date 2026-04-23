import type { AssetLineItemV2, ClassifyAssetsV2Output } from "@/lib/ai/prompts/classify-assets-v2";

/**
 * v2 Phase 8 — deterministic merge + dedupe of candidate line items
 * emitted by the fan-out classifier (ADR 0014).
 *
 * The fan-out stage produces one list of candidates per photo + one
 * list from receipts. This module:
 *
 *   1. Rejects candidates that illegally set `isResidual=true`. Fan-out
 *      prompts forbid residuals; enforcing here means a misbehaving
 *      model call can't corrupt the final schedule.
 *   2. Dedupes photo-sourced candidates across photos by normalized
 *      (name, category). Collisions keep the candidate with the higher
 *      physicalMultiplier (proxy for the clearer photo) and union
 *      photoDocumentIds into an array.
 *   3. Never dedupes receipt-sourced candidates against anything. A
 *      receipt is ground-truth cost and stays as its own line.
 *   4. Builds the residual line item deterministically (property-type's
 *      real-property class, cents = buildingValue − Σ adjusted costs).
 *
 * All of this is pure data transformation — no I/O, no LLM calls. The
 * merge is the weakest link in the fan-out because a too-loose
 * normalize() over-merges distinct items, and a too-strict one
 * regresses on the "same dining table shot from two angles" invariant.
 * Fixture tests in `tests/unit/classify-merge.test.ts` seed it with
 * real collision shapes from the audit logs.
 */

/**
 * Normalize an item name for collision detection:
 *   • lowercase
 *   • drop non-alphanumeric (keeps spaces)
 *   • drop English filler words ("the", "a", "with", "and", ...)
 *   • collapse whitespace
 *
 * Two photo-sourced candidates with the same (normalized name, category)
 * collide. Keep this function public so tests can pin down the exact
 * behavior and a future LLM-merge variant can key on the same space.
 */
const FILLER_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "with",
  "of",
  "to",
  "in",
  "on",
  "for",
  "at",
  "by",
]);

export function normalizeItemName(raw: string): string {
  const stripped = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped
    .split(" ")
    .filter((tok) => tok.length > 0 && !FILLER_WORDS.has(tok))
    .join(" ");
}

export interface MergeCandidatesInput {
  /**
   * One entry per photo slice + one entry for the receipts slice. Order
   * doesn't matter; the merge is commutative.
   */
  slices: Array<{ lineItems: AssetLineItemV2[]; assumptions?: string }>;
  buildingValueCents: number;
  /** Property-type real-property class — drives the residual line. */
  residualClass: "27_5yr" | "39yr";
}

export interface MergeCandidatesResult {
  schedule: ClassifyAssetsV2Output;
  /**
   * Telemetry: how many candidates we received vs. kept after dedupe.
   * Emitted as a `classifier.dedupe_stats` StudyEvent so ops can spot
   * drift without a test failure.
   */
  stats: {
    candidatesIn: number;
    mergedOut: number;
    collisionsResolved: number;
    illegalResidualsDropped: number;
    receiptLines: number;
    photoLines: number;
  };
  /**
   * Sum of non-residual adjusted costs. When this exceeds buildingValue,
   * the orchestrator throws a balance error and retries the whole
   * fan-out once. Exposed so the orchestrator doesn't have to re-sum.
   */
  nonResidualSumCents: number;
}

const RESIDUAL_DESCRIPTION =
  "Residual building value — foundation, framing, roof, plumbing rough-in, electrical rough-in, exterior walls, and other fixed structural components not separately itemized above. Used as the reconciling plug to hit exact building value.";

function buildResidual(residualClass: "27_5yr" | "39yr"): AssetLineItemV2 {
  return {
    category: residualClass,
    name: "Building structure (residual)",
    quantity: 1,
    unit: "lot",
    source: "pricesearch",
    comparable: { description: RESIDUAL_DESCRIPTION, unitCostCents: 0 },
    physicalMultiplier: 1,
    physicalJustification: "Reconciling residual; no adjustments applied.",
    functionalMultiplier: 1,
    functionalJustification: "Reconciling residual; no adjustments applied.",
    timeMultiplier: 1,
    timeBasis: "Reconciling residual; no adjustments applied.",
    locationMultiplier: 1,
    locationBasis: "Reconciling residual; no adjustments applied.",
    adjustedCostCents: 0,
    isResidual: true,
    rationale:
      "Reconciling residual to hit exact building value per IRS Residual Estimation Method.",
  };
}

export function mergeCandidates(input: MergeCandidatesInput): MergeCandidatesResult {
  let candidatesIn = 0;
  let illegalResidualsDropped = 0;

  // Flatten + drop any illegal residuals the model slipped in despite
  // the prompt. The fan-out invariant: residuals come from the
  // deterministic finalize stage, not from the model.
  const flat: AssetLineItemV2[] = [];
  for (const slice of input.slices) {
    for (const item of slice.lineItems) {
      candidatesIn += 1;
      if (item.isResidual === true) {
        illegalResidualsDropped += 1;
        continue;
      }
      flat.push(item);
    }
  }

  // Split receipt vs. photo candidates. Receipts never dedupe.
  const receiptItems: AssetLineItemV2[] = [];
  const photoItems: AssetLineItemV2[] = [];
  for (const item of flat) {
    if (item.source === "receipt") {
      receiptItems.push(item);
    } else {
      photoItems.push(item);
    }
  }

  // Dedupe photo candidates by (normalized name, category). On
  // collision, keep the candidate with the higher physicalMultiplier
  // (clearer photo won the condition call) and union photoDocumentIds.
  const photoByKey = new Map<string, AssetLineItemV2>();
  let collisionsResolved = 0;

  for (const incoming of photoItems) {
    const key = `${incoming.category}::${normalizeItemName(incoming.name)}`;
    const existing = photoByKey.get(key);
    if (!existing) {
      photoByKey.set(key, {
        ...incoming,
        photoDocumentIds: unionDocIds(undefined, incoming),
      });
      continue;
    }
    collisionsResolved += 1;
    const winner = incoming.physicalMultiplier > existing.physicalMultiplier ? incoming : existing;
    photoByKey.set(key, {
      ...winner,
      photoDocumentIds: unionDocIds(existing, incoming),
      // Keep whichever photo's doc id the winner ran on so legacy
      // single-field readers still point at a real photo.
      photoDocumentId:
        winner.photoDocumentId ?? winner.photoDocumentIds?.[0] ?? existing.photoDocumentId,
    });
  }

  const mergedPhotoItems = Array.from(photoByKey.values());
  const nonResidual = [...receiptItems, ...mergedPhotoItems];
  const nonResidualSumCents = nonResidual.reduce((acc, li) => acc + li.adjustedCostCents, 0);

  // Build the residual line. If nonResidualSum > buildingValue, the
  // caller decides what to do (retry the fan-out with a balance error).
  // We still emit a residual line for schema compliance; its cents may
  // be negative, which downstream validation catches.
  const residual = buildResidual(input.residualClass);
  const residualCents = input.buildingValueCents - nonResidualSumCents;
  const residualWithPlug: AssetLineItemV2 = {
    ...residual,
    adjustedCostCents: residualCents,
    comparable: { ...residual.comparable, unitCostCents: residualCents },
  };

  const lineItems = [...nonResidual, residualWithPlug];

  const schedule: ClassifyAssetsV2Output = {
    lineItems,
    assumptions: collectAssumptions(input.slices),
  };

  return {
    schedule,
    stats: {
      candidatesIn,
      mergedOut: lineItems.length,
      collisionsResolved,
      illegalResidualsDropped,
      receiptLines: receiptItems.length,
      photoLines: mergedPhotoItems.length,
    },
    nonResidualSumCents,
  };
}

function unionDocIds(existing: AssetLineItemV2 | undefined, incoming: AssetLineItemV2): string[] {
  const set = new Set<string>();
  const push = (id: string | undefined | null) => {
    if (typeof id === "string" && id.length > 0) set.add(id);
  };
  if (existing) {
    push(existing.photoDocumentId ?? null);
    for (const id of existing.photoDocumentIds ?? []) push(id);
  }
  push(incoming.photoDocumentId ?? null);
  for (const id of incoming.photoDocumentIds ?? []) push(id);
  return Array.from(set);
}

function collectAssumptions(slices: Array<{ assumptions?: string }>): string {
  const combined = slices
    .map((s) => (typeof s.assumptions === "string" ? s.assumptions.trim() : ""))
    .filter((a) => a.length > 0);
  if (combined.length === 0) return "";
  // Join with a separator; cap at the monolith's 2000-char ceiling so
  // AiAuditLog rows stay under index limits.
  return combined.join("\n\n---\n\n").slice(0, 2000);
}
