import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Methodology"
        description="How every Cost Seg report is produced, in enough detail to reproduce."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <h2>Regulatory framework</h2>
        <ul>
          <li>
            <strong>Revenue Procedure 87-56</strong> — asset classes for MACRS depreciation.
          </li>
          <li>
            <strong>Revenue Procedure 2004-34</strong> — safe-harbor guidelines for compliance.
          </li>
          <li>
            <strong>Treasury Regulation §1.167(a)-1</strong> — general depreciation rules.
          </li>
          <li>
            <strong>Treasury Regulation §1.263(a)-1</strong> — capital expenditure and repair
            allocation.
          </li>
          <li>
            <strong>IRS Publication 5653</strong> — Cost Segregation Audit Techniques Guide (Feb
            2025).
          </li>
        </ul>

        <h2>Valuation method — Residual Estimation + RCNLD</h2>
        <p>
          We use the Residual Estimation Method endorsed in Chapter 3, Section C.4 of the ATG. Total
          property basis is allocated across components using their Replacement Cost New (RCN)
          adjusted by time, location, physical depreciation, and functional obsolescence.
        </p>
        <pre>
          {`Component Allocated Value = (Component Adjusted Value / Σ Adjusted Values) × Total Basis
RCNLD = RCN × Time × Location × Physical × Functional`}
        </pre>

        <h2>Cost sources</h2>
        <ul>
          <li>
            <strong>RSMeans Building Construction Cost Data</strong> — structural, HVAC, electrical.
          </li>
          <li>
            <strong>Craftsman National Repair &amp; Remodeling Estimator (2026)</strong> —
            materials, labor, overhead.
          </li>
          <li>
            <strong>PriceSearch market research</strong> — appliances, lighting, specialty
            equipment.
          </li>
        </ul>
        <p>
          A 10% general-contractor overhead markup is applied to RSMeans and Craftsman estimates,
          not to PriceSearch.
        </p>

        <h2>Classification decisions</h2>
        <p>
          Every line item is evaluated against the Whiteco factors (permanence test), HCA tests
          (sole-justification), and the necessary-vs-decorative framework to determine Section 1245
          (personal property, accelerated) vs Section 1250 (structural, 27.5-/39-year).
        </p>

        <h2>Bonus depreciation</h2>
        <p>
          For acquisition and placed-in-service dates that qualify under the One Big Beautiful Bill
          Act (2025+) or fall within the TCJA window (before September 28, 2017 acquisitions are
          ineligible), the applicable bonus rate is applied. The schedule page shows the rate and
          the eligibility reasoning explicitly.
        </p>

        <h2>Engineer review (Tier-2)</h2>
        <p>
          A US-licensed Professional Engineer reviews every classification decision, verifies the
          13-element ATG compliance checklist, and signs the final report. The engineer&rsquo;s
          license number and signature block appear on the cover page and the certification page.
        </p>
        <p className="text-muted-foreground text-sm">
          Last updated {new Date().toLocaleDateString()}.
        </p>
      </div>
    </Container>
  );
}
