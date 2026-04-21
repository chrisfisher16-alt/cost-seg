import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Scope disclosure" };

/**
 * Static effective date for the scope disclosure. Update when the policy text
 * is actually edited — NOT on every page render. Using `new Date()` here
 * previously made the date tick forward on every reload and drift with
 * browser locale ("4/20/2026" vs. "20/04/2026"), misleading visitors into
 * believing the policy was freshly updated.
 */
const LAST_UPDATED = "April 19, 2026";

export default function ScopeDisclosurePage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Scope disclosure"
        description="What this software produces, what it doesn’t, and how to file responsibly."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <h2>The three tiers, in plain terms</h2>
        <p>
          <strong>DIY Self-Serve ($149)</strong> is a self-guided calculator. You enter the basis
          and land value; we apply property-type-default asset allocations from our library and
          produce a branded PDF with the full MACRS schedule. No AI extraction, no engineer review.
          Planning only — have your CPA verify the inputs.
        </p>
        <p>
          <strong>AI Report ($295)</strong> is a software-generated modeling and planning study. An
          AI pipeline reads your closing disclosure and improvement receipts, decomposes the basis,
          and classifies each asset into its MACRS life. The methodology follows the Residual
          Estimation Method combined with Replacement Cost New Less Depreciation (RCNLD), as
          outlined in the IRS Cost Segregation Audit Techniques Guide (Publication 5653, 2-2025).
        </p>
        <p>
          <strong>Engineer-Reviewed ($1,495)</strong> is the AI Report plus review and signature by
          a US-licensed Professional Engineer, plus a 13-element compliance checklist aligned with
          Chapter 4 of Publication 5653. This is the tier intended for audit-defensible filing.
        </p>
        <h2>What none of the tiers are</h2>
        <p>
          DIY and AI Report are <strong>not</strong> complete engineered cost segregation studies
          signed by a Professional Engineer. They do not include a physical site inspection. They
          should not be attached to a filed tax return or relied upon in an IRS examination without
          the review of a credentialed tax professional. The Engineer-Reviewed tier is the one
          intended for attaching to a return.
        </p>
        <h2>Upgrade paths</h2>
        <p>
          Your inputs carry forward. A DIY study can be upgraded to AI Report or Engineer-Reviewed
          without re-entering anything, and AI Report upgrades to Engineer-Reviewed without
          re-uploading documents. You pay the delta.
        </p>
        <h2>Bonus depreciation eligibility</h2>
        <p>
          Every report explicitly checks your acquisition date against the Tax Cuts and Jobs Act
          (TCJA) cutoff of September 28, 2017, and your placed-in-service date against the One Big
          Beautiful Bill Act (OBBBA) eligibility window. The applied bonus rate is displayed on the
          schedule page.
        </p>
        <h2>Limits of liability</h2>
        <p>
          Segra is not your tax advisor and does not provide tax advice. Have a credentialed tax
          professional review every report before it informs a tax filing.
        </p>
        <p className="text-muted-foreground text-sm">Last updated {LAST_UPDATED}.</p>
      </div>
    </Container>
  );
}
