import "server-only";

import { downloadStudyFile } from "@/lib/storage/studies";

import type { AiReportProps } from "@/components/pdf/AiReportTemplate";

/**
 * v2 → PDF props mapping helpers (ADR 0012). Extracted from deliver.ts
 * so the mapping logic can be unit-tested without loading the entire
 * deliver pipeline + its Supabase admin client.
 *
 * Deliver.ts is responsible for passing in the v2 schedule JSON, the
 * property enrichment JSON, and the list of photo documents. The
 * helpers here produce AiReportProps-shaped fragments — specifically:
 *   • `mapV2LineItems` turns v2 line items into the template's
 *     `schedule.lineItems` shape, threading photo data URIs in.
 *   • `mapEnrichment` turns the persisted enrichment blob into the
 *     Property Info page's optional enrichment subset.
 *   • `loadPhotoDataUrisByDocumentId` fetches photo bytes from storage
 *     and returns a Map ready for `mapV2LineItems`.
 */

/** v2 asset-schedule line shape (verbatim from classify-assets-v2). */
export interface V2LineItem {
  category: string;
  name: string;
  quantity: number;
  unit: string;
  source: string;
  comparable: {
    description: string;
    unitCostCents: number;
    sourceUrl?: string;
  };
  physicalMultiplier: number;
  physicalJustification: string;
  functionalMultiplier: number;
  functionalJustification: string;
  timeMultiplier: number;
  timeBasis: string;
  locationMultiplier: number;
  locationBasis: string;
  adjustedCostCents: number;
  photoDocumentId?: string;
  isResidual?: boolean;
  rationale: string;
}

export type RenderedLineItem = AiReportProps["schedule"]["lineItems"][number];

/**
 * Map v2 line items into the render-time shape. `adjustedCostCents`
 * becomes `amountCents` so existing MACRS + Form 3115 math keeps
 * working against the same field. Photo data URIs are resolved from
 * the caller-supplied map; unmatched `photoDocumentId`s fall back to
 * "no photo" (the detail card copes).
 */
export function mapV2LineItems(
  items: V2LineItem[],
  photoDataUriByDocumentId: Map<string, string>,
): RenderedLineItem[] {
  return items.map((li) => ({
    category: li.category,
    name: li.name,
    amountCents: li.adjustedCostCents,
    rationale: li.rationale,
    quantity: li.quantity,
    unit: li.unit,
    unitCostCents: li.comparable.unitCostCents,
    costSource: li.source,
    physicalMultiplier: li.physicalMultiplier,
    functionalMultiplier: li.functionalMultiplier,
    timeMultiplier: li.timeMultiplier,
    locationMultiplier: li.locationMultiplier,
    physicalJustification: li.physicalJustification,
    functionalJustification: li.functionalJustification,
    timeBasis: li.timeBasis,
    locationBasis: li.locationBasis,
    comparableDescription: li.comparable.description,
    comparableSourceUrl: li.comparable.sourceUrl,
    photoDataUri: li.photoDocumentId ? photoDataUriByDocumentId.get(li.photoDocumentId) : undefined,
    isResidual: li.isResidual,
  }));
}

/**
 * Enrichment subset carried on AiReportProps. Mirrors the shape the
 * template's `property.enrichment` field accepts — only the fields
 * the Property Info page actually renders. Null fields propagate as
 * null so the page can distinguish "absent" from "zero".
 */
export type RenderedEnrichment = NonNullable<AiReportProps["property"]["enrichment"]>;

export function mapEnrichment(raw: unknown): RenderedEnrichment | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const strOrNull = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;
  return {
    squareFeet: numOrNull(r.squareFeet),
    yearBuilt: numOrNull(r.yearBuilt),
    bedrooms: numOrNull(r.bedrooms),
    bathrooms: numOrNull(r.bathrooms),
    constructionType: strOrNull(r.constructionType),
    roofType: strOrNull(r.roofType),
    lotSizeSqft: numOrNull(r.lotSizeSqft),
    assessorUrl: strOrNull(r.assessorUrl),
    listingUrl: strOrNull(r.listingUrl),
  };
}

/** Photo metadata deliver.ts reads out of Document rows. */
export interface PhotoDocRef {
  documentId: string;
  storagePath: string;
  mimeType: string;
}

/**
 * Download each photo from Supabase Storage, encode as base64, return
 * a Map keyed by documentId. Missing / unreadable photos are skipped
 * silently — the render-time card falls back to no-photo layout.
 */
export async function loadPhotoDataUrisByDocumentId(
  photos: PhotoDocRef[],
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    photos.map(async (photo) => {
      try {
        const blob = await downloadStudyFile(photo.storagePath);
        const buffer = Buffer.from(await blob.arrayBuffer());
        const mime =
          photo.mimeType === "image/jpeg" || photo.mimeType === "image/png"
            ? photo.mimeType
            : "image/jpeg";
        const dataUri = `data:${mime};base64,${buffer.toString("base64")}`;
        return [photo.documentId, dataUri] as const;
      } catch (err) {
        console.warn(`[pdf-v2] failed to load photo ${photo.documentId}`, err);
        return null;
      }
    }),
  );
  const map = new Map<string, string>();
  for (const e of entries) {
    if (e) map.set(e[0], e[1]);
  }
  return map;
}

/**
 * Return true iff the persisted assetSchedule was produced by the v2
 * classifier (Phase 2). Shape guard — deliver.ts branches on this to
 * pick the v1 vs. v2 mapping.
 *
 * `finalizeStudy` in pipeline.ts persists the assetSchedule as
 * `{ decomposition, schedule, narrative, totalCents }` and the schema
 * marker (`{ schema: "v2", lineItems, assumptions }`) lives INSIDE
 * `schedule`, not at the top level. A prior version of this guard
 * checked `stored.schema` directly and silently returned false for every
 * real study — routing v2-shaped data through the v1 template path
 * (which reads `amountCents`, not present on v2 items) and cascading
 * `$NaN` into every cost display + skipping photos entirely.
 *
 * Both paths are accepted for belt-and-suspenders: if an earlier caller
 * or a future refactor flattens the shape, the guard still works.
 */
export function isV2Schedule(stored: unknown): boolean {
  if (typeof stored !== "object" || stored === null) return false;
  const top = stored as Record<string, unknown>;
  if (top.schema === "v2") return true;
  const nested = top.schedule;
  if (nested && typeof nested === "object") {
    if ((nested as Record<string, unknown>).schema === "v2") return true;
  }
  return false;
}
