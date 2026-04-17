import { z } from "zod";

export const PROPERTY_TYPES = [
  "SINGLE_FAMILY_RENTAL",
  "SHORT_TERM_RENTAL",
  "SMALL_MULTIFAMILY",
  "MID_MULTIFAMILY",
  "COMMERCIAL",
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  SINGLE_FAMILY_RENTAL: "Single-family rental",
  SHORT_TERM_RENTAL: "Short-term rental",
  SMALL_MULTIFAMILY: "Small multifamily (2–4 units)",
  MID_MULTIFAMILY: "Mid multifamily (5+ units)",
  COMMERCIAL: "Commercial",
};

export const estimatorInputSchema = z.object({
  propertyType: z.enum(PROPERTY_TYPES),
  purchasePriceCents: z
    .number()
    .int()
    .positive()
    .max(100_000_000_000, "Purchase price must be under $1B"),
  address: z.string().trim().min(3).max(200).optional(),
  taxBracket: z.number().min(0.1).max(0.5).optional(),
});

export type EstimatorInput = z.infer<typeof estimatorInputSchema>;

export const estimatorResultSchema = z.object({
  reclassifiedLowCents: z.number().int().nonnegative(),
  reclassifiedHighCents: z.number().int().nonnegative(),
  savingsLowCents: z.number().int().nonnegative(),
  savingsHighCents: z.number().int().nonnegative(),
  lowPct: z.number(),
  highPct: z.number(),
  assumedBracket: z.number(),
});

export type EstimatorResult = z.infer<typeof estimatorResultSchema>;
