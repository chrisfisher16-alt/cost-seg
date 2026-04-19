import { CATALOG, formatCents, type Tier } from "@/lib/stripe/catalog";

/**
 * Marketing-facing tier catalog. Extends the DB-backed CATALOG with the DIY
 * self-serve tier, which launches Day 2 with its own pipeline and Stripe SKU.
 * Until then, the DIY card renders a waitlist CTA that captures email via the
 * existing Lead table (no schema changes required).
 */
export type MarketingTier = "DIY" | Tier;

export interface MarketingTierEntry {
  id: MarketingTier;
  label: string;
  priceCents: number;
  priceNote: string;
  tagline: string;
  turnaround: string;
  badge?: { label: string; tone: "primary" | "accent" | "muted" };
  featured?: boolean;
  comingSoon?: boolean;
  bullets: string[];
  limitations?: string[];
  bestFor: string;
  footnote: string;
  ctaLabel: string;
  ctaHref: string;
}

export const MARKETING_TIERS: MarketingTierEntry[] = [
  {
    id: "DIY",
    label: "DIY Self-Serve",
    priceCents: 14900,
    priceNote: "per property",
    tagline: "For the hands-on investor who wants the math, fast.",
    turnaround: "Instant",
    bullets: [
      "Guided self-serve wizard — you enter basis + land value",
      "Full 40-row MACRS schedule with half-year / mid-month conventions",
      "Branded PDF with methodology appendix (Cover, Exec Summary, Asset Schedule, Appendix A–D)",
      "IRS Pub 946 + TCJA/OBBBA bonus-depreciation eligibility check built in",
      "Upgrade to AI Report or Engineer-Reviewed anytime without re-entering data",
    ],
    limitations: ["No document parsing — you bring the numbers", "No engineer sign-off"],
    bestFor: "Single-family STRs and small residential rentals where you already know your basis.",
    footnote: "Planning tool. Have your CPA review before filing.",
    ctaLabel: "Start a DIY study",
    ctaHref: "/get-started?tier=DIY",
  },
  {
    id: "AI_REPORT",
    label: CATALOG.AI_REPORT.label,
    priceCents: CATALOG.AI_REPORT.priceCents,
    priceNote: "per property",
    tagline: "The full modeling report, generated end-to-end in minutes.",
    turnaround: "Delivered in minutes",
    badge: { label: "Most popular", tone: "primary" },
    featured: true,
    bullets: [
      "Everything in DIY, plus full AI pipeline",
      "Claude reads your closing disclosure and improvement receipts directly",
      "Per-asset classification with Section 1245 vs 1250 rationale",
      "Full narrative methodology, year-one projection, and appendix",
      "214-page-class report template, branded and printable",
    ],
    bestFor: "Short-term rentals, small multifamily, commercial under $1.5M basis.",
    footnote: "Planning tool — not an IRS-defensible engineered study on its own.",
    ctaLabel: "Start an AI Report",
    ctaHref: "/get-started?tier=AI_REPORT",
  },
  {
    id: "ENGINEER_REVIEWED",
    label: CATALOG.ENGINEER_REVIEWED.label,
    priceCents: CATALOG.ENGINEER_REVIEWED.priceCents,
    priceNote: "per property",
    tagline: "AI speed, licensed-engineer signature, audit-defensible.",
    turnaround: "Delivered in 3–7 days",
    badge: { label: "Audit-ready", tone: "accent" },
    bullets: [
      "Everything in AI Report",
      "Reviewed and signed by a US-licensed Professional Engineer",
      "13-element ATG compliance checklist tracked on your dashboard",
      "Audit-defensible under IRS Pub 5653",
      "Upgrade path from AI Report without re-uploading documents",
    ],
    bestFor: "Anyone filing, any property type, any basis size.",
    footnote: "Engineer contracted by us. Review takes 3–7 business days.",
    ctaLabel: "Start an engineered study",
    ctaHref: "/get-started?tier=ENGINEER_REVIEWED",
  },
];

export const AUDIT_PROTECTION_ADDON = {
  id: "AUDIT_PROTECTION",
  label: "Lifetime Audit Protection",
  priceCents: 19500,
  comingSoon: true,
  blurb:
    "If the IRS examines the tax return that used this study, a licensed CPA or EA will defend the methodology and respond to IDRs — at no additional cost, for the life of the depreciation schedule.",
  bullets: [
    "Representation by a CPA or Enrolled Agent (Circular-230 credentials)",
    "Work papers, source documentation, and methodology transfer",
    "IDR response drafting and examiner communication",
    "Renewable per-property coverage",
  ],
  footnote: "Underwritten via a licensed tax-audit-protection partner. Launching 2026 Q3.",
};

export function formatTierPrice(cents: number): string {
  return formatCents(cents);
}
