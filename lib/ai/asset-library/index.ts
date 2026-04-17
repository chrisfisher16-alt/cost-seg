import singleFamily from "./single-family-rental.json";
import shortTerm from "./short-term-rental.json";
import smallMulti from "./small-multifamily.json";
import midMulti from "./mid-multifamily.json";
import commercial from "./commercial.json";

import { assetLibrarySchema, type AssetCategory } from "./types";

import type { PropertyType } from "@prisma/client";

const RAW: Record<PropertyType, unknown> = {
  SINGLE_FAMILY_RENTAL: singleFamily,
  SHORT_TERM_RENTAL: shortTerm,
  SMALL_MULTIFAMILY: smallMulti,
  MID_MULTIFAMILY: midMulti,
  COMMERCIAL: commercial,
};

export function getAssetLibrary(propertyType: PropertyType): AssetCategory[] {
  const raw = RAW[propertyType];
  const parsed = assetLibrarySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Asset library for ${propertyType} failed validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

export { type AssetCategory, assetLibrarySchema } from "./types";
