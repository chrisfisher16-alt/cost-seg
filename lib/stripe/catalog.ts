/**
 * Single source of truth for tier pricing. See ADR 0005.
 * Stripe Price IDs come from env so Stripe remains swappable per environment.
 */
export type Tier = "AI_REPORT" | "ENGINEER_REVIEWED";

export interface TierCatalogEntry {
  tier: Tier;
  label: string;
  priceCents: number;
  stripePriceIdEnv: "STRIPE_PRICE_ID_TIER_1" | "STRIPE_PRICE_ID_TIER_2";
  blurb: string;
}

export const CATALOG: Record<Tier, TierCatalogEntry> = {
  AI_REPORT: {
    tier: "AI_REPORT",
    label: "AI Report",
    priceCents: 29500,
    stripePriceIdEnv: "STRIPE_PRICE_ID_TIER_1",
    blurb:
      "Software-generated modeling report in minutes. Planning tool — not an IRS-defensible study.",
  },
  ENGINEER_REVIEWED: {
    tier: "ENGINEER_REVIEWED",
    label: "Engineer-Reviewed Study",
    priceCents: 149500,
    stripePriceIdEnv: "STRIPE_PRICE_ID_TIER_2",
    blurb:
      "Same output, reviewed and signed by a US-licensed PE. Audit-defensible under IRS Pub 5653.",
  },
};

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
