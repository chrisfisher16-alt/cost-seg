import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Scope disclosure" };

export default function ScopeDisclosurePage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Scope disclosure"
        description="What this software produces, what it doesn&rsquo;t, and how to file responsibly."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <h2>What a Cost Seg AI Report is</h2>
        <p>
          Your AI Report is a software-generated modeling and planning tool. It applies the Residual
          Estimation Method combined with Replacement Cost New Less Depreciation (RCNLD), as
          outlined in the IRS Cost Segregation Audit Techniques Guide (Publication 5653, 2-2025), to
          allocate your property basis across MACRS classes.
        </p>
        <h2>What it is not</h2>
        <p>
          It is <strong>not</strong> a complete engineered cost segregation study signed by a
          Professional Engineer. It does not include a physical site inspection. It should not be
          attached to a filed tax return or relied upon in an IRS examination without the review of
          a credentialed tax professional.
        </p>
        <h2>The Engineer-Reviewed tier</h2>
        <p>
          Our Engineer-Reviewed tier adds review and signature by a US-licensed Professional
          Engineer, plus a 13-element compliance checklist aligned with Chapter 4 of Publication
          5653. That is the tier intended for audit-defensible filing.
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
          Cost Seg is not your tax advisor and does not provide tax advice. Have a credentialed tax
          professional review every report before it informs a tax filing.
        </p>
        <p className="text-muted-foreground text-sm">
          Last updated {new Date().toLocaleDateString()}.
        </p>
      </div>
    </Container>
  );
}
