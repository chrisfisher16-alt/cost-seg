/**
 * Short scope disclosure — the pre-purchase / pre-delivery expectation-
 * setter. Appears on marketing surfaces (estimator, intake, get-started
 * sidebar) and in the post-payment welcome email.
 *
 * Covers the same three material claims as the full PDF-footer disclosure
 * (`lib/pdf/disclosure.ts` → `TIER_1_SCOPE_DISCLOSURE`):
 *
 *   1. This is software-produced, not engineer-signed.
 *   2. It is not a complete cost segregation study under IRS Publication 5653.
 *   3. Do not file a tax return relying on it without independent CPA review.
 *
 * Deliberately OMITS two things that only make sense in the delivery
 * artifact:
 *   - "Not reviewed or signed by a licensed professional engineer" — the
 *     PDF cover + PageFooter announce this is a Tier-1 AI report; restating
 *     it on marketing is redundant with pricing.
 *   - "Contact us about upgrading to the Engineer-Reviewed tier" — wrong
 *     on pre-purchase pages (the customer hasn't bought yet) and on the
 *     welcome email (they just paid — the upsell lives in the post-
 *     delivery surfaces, not here).
 *
 * Pure module. No server-only / node:* / Prisma imports so both
 * `"use client"` marketing components and server-rendered email
 * templates can consume it.
 */

export const SCOPE_DISCLOSURE_SHORT =
  "This is a planning and modeling estimate produced by software. It is not a complete cost segregation study under the IRS Cost Segregation Audit Techniques Guide (Publication 5653). Do not file a tax return relying on it without your CPA's independent review.";
