import type { DocumentKind } from "@prisma/client";

export interface DocumentKindMeta {
  kind: DocumentKind;
  label: string;
  description: string;
  required: boolean;
  allowMultiple: boolean;
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
  },
  PROPERTY_PHOTO: {
    kind: "PROPERTY_PHOTO",
    label: "Property photos",
    description:
      "Exterior, interior, kitchen, bath. JPG/PNG. Min 1 photo — add as many as you like.",
    required: true,
    allowMultiple: true,
  },
  IMPROVEMENT_RECEIPTS: {
    kind: "IMPROVEMENT_RECEIPTS",
    label: "Improvement receipts",
    description:
      "Any post-acquisition improvements (roof, HVAC, finishes, landscaping). Optional — skip if this is a new purchase.",
    required: false,
    allowMultiple: true,
  },
  APPRAISAL: {
    kind: "APPRAISAL",
    label: "Appraisal",
    description: "Optional. Useful for engineer-reviewed studies.",
    required: false,
    allowMultiple: false,
  },
  OTHER: {
    kind: "OTHER",
    label: "Other",
    description: "Anything else you want the engineer to see.",
    required: false,
    allowMultiple: true,
  },
};
