import type { DocumentKind } from "@prisma/client";

/**
 * Shorthand MIME tuples per DocumentKind. The client uses these to build
 * the file-input `accept` string and validate pre-upload; the server has a
 * superset allowlist in lib/storage/validate.ts.
 *
 * Keep the values aligned with ALLOWED_MIMES there — adding one here without
 * updating the server validator will surface as "File type … is not
 * accepted." on finalize.
 */
export type AcceptedExt = "pdf" | "jpg" | "png" | "xlsx" | "xls";

const ALL_DOC_EXTS: AcceptedExt[] = ["pdf", "jpg", "png", "xlsx", "xls"];
const PHOTO_EXTS: AcceptedExt[] = ["jpg", "png"];
const RECEIPT_EXTS: AcceptedExt[] = ["pdf", "jpg", "png", "xlsx", "xls"];
const DOC_ONLY_EXTS: AcceptedExt[] = ["pdf", "jpg", "png"];

export const EXT_TO_MIME: Record<AcceptedExt, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
};

export function acceptAttrForExts(exts: readonly AcceptedExt[]): string {
  const fileExts = exts.map((e) => `.${e === "jpg" ? "jpg,.jpeg" : e}`).join(",");
  const mimes = exts.map((e) => EXT_TO_MIME[e]).join(",");
  return `${fileExts},${mimes}`;
}

export interface DocumentKindMeta {
  kind: DocumentKind;
  label: string;
  description: string;
  required: boolean;
  allowMultiple: boolean;
  /** File extensions (and their MIME types) accepted for this kind. */
  acceptedExts: AcceptedExt[];
}

export const DOCUMENT_KIND_ORDER: DocumentKind[] = [
  "CLOSING_DISCLOSURE",
  "PROPERTY_PHOTO",
  "IMPROVEMENT_RECEIPTS",
  "APPRAISAL",
];

export const DOCUMENT_KIND_META: Record<DocumentKind, DocumentKindMeta> = {
  CLOSING_DISCLOSURE: {
    kind: "CLOSING_DISCLOSURE",
    label: "Closing disclosure",
    description: "Closing Disclosure (CD) or HUD-1. One PDF, typically 5–10 pages.",
    required: true,
    allowMultiple: false,
    acceptedExts: DOC_ONLY_EXTS,
  },
  PROPERTY_PHOTO: {
    kind: "PROPERTY_PHOTO",
    label: "Property photos",
    description:
      "Exterior, interior, kitchen, bath. JPG/PNG. Min 1 photo — add as many as you like.",
    required: true,
    allowMultiple: true,
    acceptedExts: PHOTO_EXTS,
  },
  IMPROVEMENT_RECEIPTS: {
    kind: "IMPROVEMENT_RECEIPTS",
    label: "Improvement receipts",
    description:
      "Any post-acquisition improvements (roof, HVAC, finishes, landscaping). PDFs, photos, or Excel spreadsheets welcome. Optional — skip if this is a new purchase.",
    required: false,
    allowMultiple: true,
    acceptedExts: RECEIPT_EXTS,
  },
  APPRAISAL: {
    kind: "APPRAISAL",
    label: "Appraisal",
    description: "Optional. Useful for engineer-reviewed studies.",
    required: false,
    allowMultiple: false,
    acceptedExts: DOC_ONLY_EXTS,
  },
  OTHER: {
    kind: "OTHER",
    label: "Other",
    description: "Anything else you want the engineer to see.",
    required: false,
    allowMultiple: true,
    acceptedExts: ALL_DOC_EXTS,
  },
};
