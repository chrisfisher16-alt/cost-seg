import { z } from "zod";

export const depreciationClassEnum = z.enum(["5yr", "7yr", "15yr", "27_5yr", "39yr"]);
export type DepreciationClass = z.infer<typeof depreciationClassEnum>;

/**
 * Canonical shape for a single row in a per-property-type asset library.
 * Used as reference input to Step C's prompt — Claude anchors its
 * classification to these categories and can propose additional ones.
 */
export const assetCategorySchema = z.object({
  name: z.string().min(1).max(80),
  depreciationClass: depreciationClassEnum,
  /** Low end of typical % of building value (not total purchase price). */
  typicalPctLow: z.number().min(0).max(1),
  /** High end of typical % of building value. */
  typicalPctHigh: z.number().min(0).max(1),
  /** Plain-language example the model can cite in rationale. */
  examples: z.string().min(1).max(400),
});

export type AssetCategory = z.infer<typeof assetCategorySchema>;

export const assetLibrarySchema = z.array(assetCategorySchema);
