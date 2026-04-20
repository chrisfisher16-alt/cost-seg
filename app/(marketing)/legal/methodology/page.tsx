import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Methodology" };

const EFFECTIVE = "April 19, 2026";

export default function MethodologyPage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Methodology"
        description="How every Segra report is produced, in enough detail to reproduce."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <p className="text-muted-foreground text-sm">Effective {EFFECTIVE}.</p>

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
            <strong>IRC §168(k)</strong> — bonus depreciation eligibility and percentages.
          </li>
          <li>
            <strong>IRC §481(a)</strong> — method-change catch-up adjustment math (applies to
            prior-year filings).
          </li>
          <li>
            <strong>IRS Publication 5653</strong> — Cost Segregation Audit Techniques Guide (Feb
            2025).
          </li>
          <li>
            <strong>Tax Cuts and Jobs Act (TCJA, 2017)</strong> — bonus-depreciation acquisition
            cutoff of September 28, 2017.
          </li>
          <li>
            <strong>One Big Beautiful Bill Act (OBBBA, 2025)</strong> — 100% bonus depreciation
            restored for property placed in service on or after January 19, 2025.
          </li>
        </ul>

        <h2>Tier 1 — DIY Self-Serve</h2>
        <p>
          DIY uses a deterministic calculator, not an AI pipeline. You supply the purchase price,
          land value, and property type. The calculator applies a property-type-default asset
          allocation curve drawn from our internal asset library — typical 5/7/15/27.5-or-39-year
          percentages for STRs, small multifamily, commercial, etc. — then normalizes line-item
          totals so they reconcile exactly to the building basis you entered. The result is a full
          MACRS schedule and a branded PDF. No document parsing, no engineer review; CPA review
          recommended before filing.
        </p>

        <h2>Tier 2 — AI Report (also foundational to Tier 3)</h2>
        <h3>Document ingestion</h3>
        <p>
          The closing disclosure, improvement receipts, and property photos you upload are OCR-ed
          via AWS Textract, then the normalized text is handed to a Claude model. Claude extracts
          purchase price, acquisition date, property type, and line items from construction receipts
          or settlement statements.
        </p>
        <h3>Valuation method — Residual Estimation + RCNLD</h3>
        <p>
          We use the Residual Estimation Method endorsed in Chapter 3, Section C.4 of the ATG. Total
          property basis is allocated across components using their Replacement Cost New (RCN)
          adjusted by time, location, physical depreciation, and functional obsolescence.
        </p>
        <pre>
          {`Component Allocated Value = (Component Adjusted Value / Σ Adjusted Values) × Total Basis
RCNLD = RCN × Time × Location × Physical × Functional`}
        </pre>
        <h3>Cost sources</h3>
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
        <h3>Classification decisions</h3>
        <p>
          Every line item is evaluated against the <strong>Whiteco factors</strong> (permanence
          test), the <strong>HCA tests</strong> (sole-justification test from Hospital Corporation
          of America v. Commissioner, 109 T.C. 21), and the{" "}
          <strong>necessary-vs-decorative framework</strong> from Rev. Rul. 79-181 to determine
          Section 1245 (personal property, accelerated 5/7/15-year) vs Section 1250 (structural,
          27.5- or 39-year).
        </p>

        <h2>Land-value decomposition</h2>
        <p>
          Every report separates land from building basis before any MACRS classification. We try
          three methods in order and use the first that fits the property: assessor ratio (county
          tax assessment), appraisal method (if a recent appraisal is in the uploaded docs), or
          comparable-sales residual. The method chosen and the split are both disclosed on the Land
          Value page of the PDF.
        </p>

        <h2>Bonus depreciation</h2>
        <p>
          For every property, we check the acquisition date against the TCJA cutoff (acquisitions
          before September 28, 2017 are ineligible for the post-TCJA percentages), then check the
          placed-in-service date against the OBBBA 100% window. The applicable bonus rate and the
          eligibility reasoning are both shown on the Depreciation Schedule page — no hidden
          assumptions.
        </p>

        <h2>Method change — Form 3115 / Form 4562 (Appendix E)</h2>
        <p>
          If your property was placed in service in a prior year and depreciated on a
          non-cost-segregated basis, claiming the reclassified basis requires a method change under
          Rev. Proc. 2022-14 (automatic-consent DCN 7), filed on Form 3115 with a §481(a) catch-up
          adjustment. If the property was placed in service this year, Form 4562 is used instead (no
          method change required). Every study ships with Appendix E — a CPA filing worksheet that
          determines which form applies, computes the §481(a) catch-up by running both depreciation
          schedules (old SL vs new cost-seg) for every prior year and summing deltas, and emits
          per-class pre-fills for the filing CPA. Source: IRS Rev. Proc. 2015-13 and Rev. Proc.
          2022-14.
        </p>

        <h2>Tier 3 — Engineer review</h2>
        <p>
          A US-licensed Professional Engineer independently reviews every classification decision,
          verifies the 13-element ATG compliance checklist (ATG Chapter 4), and signs the final
          report. The engineer&rsquo;s license number, state of licensure, and signature block
          appear on the cover page and on the certification page. Any classification the engineer
          overrides is flagged in Appendix B alongside the AI&rsquo;s original rationale.
        </p>

        <h2>Reproducibility</h2>
        <p>
          Every report ships with four appendices that let any competent tax professional reproduce
          the math:
        </p>
        <ul>
          <li>
            <strong>Appendix A</strong> — full methodology deep-dive.
          </li>
          <li>
            <strong>Appendix B</strong> — per-asset detail cards with source, rationale, and IRS
            citation for every line item.
          </li>
          <li>
            <strong>Appendix C</strong> — reference documents (Rev. Proc. 87-56 table excerpt, Pub
            946 MACRS tables, TCJA/OBBBA timeline, the 13-element ATG checklist).
          </li>
          <li>
            <strong>Appendix D</strong> — expenditure classification schedule aligning every line
            item to its MACRS life.
          </li>
          <li>
            <strong>Appendix E</strong> — Form 3115 / Form 4562 CPA filing worksheet (Tier 2 and
            Tier 3 only).
          </li>
        </ul>
      </div>
    </Container>
  );
}
