import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Terms" };

const EFFECTIVE = "April 19, 2026";

export default function TermsPage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Terms of service"
        description="Plain-English version: use it well, and we owe you the report."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <p className="text-muted-foreground text-sm">Effective {EFFECTIVE}.</p>

        <p>
          These terms govern your use of Cost Seg (the &ldquo;Service&rdquo;). By creating an
          account or paying for a study, you agree to them. If something&rsquo;s unclear, write to{" "}
          <span className="font-mono">support@costseg.app</span>.
        </p>

        <h2>What the Service is</h2>
        <p>Cost Seg provides three product tiers:</p>
        <ul>
          <li>
            <strong>DIY Self-Serve ($149)</strong> — a self-guided calculator that applies
            property-type-default asset allocations and produces a branded PDF with a full MACRS
            schedule. Planning tool only.
          </li>
          <li>
            <strong>AI Report ($295)</strong> — a software-generated modeling and planning study. An
            AI pipeline reads your documents and classifies assets per the methodology described at{" "}
            <a href="/legal/methodology">/legal/methodology</a>. Planning tool only; not a Pub
            5653-engineered study.
          </li>
          <li>
            <strong>Engineer-Reviewed ($1,495)</strong> — the AI Report plus review and signature by
            a US-licensed Professional Engineer and a 13-element ATG compliance checklist. This is
            the tier intended for audit-defensible filing.
          </li>
        </ul>
        <p>
          Scope specifics for each tier, and what we&rsquo;re <em>not</em> providing, are spelled
          out at <a href="/legal/scope-disclosure">/legal/scope-disclosure</a>. We are not your tax
          advisor. Every study should be reviewed by a credentialed tax professional before it
          informs a filing.
        </p>

        <h2>Your account</h2>
        <ul>
          <li>
            You must be 18 or older and have authority to act on behalf of the property owner.
          </li>
          <li>
            Keep your login credentials private. You&rsquo;re responsible for activity under your
            account.
          </li>
          <li>
            Information you give us (email, property facts, documents) should be truthful and yours
            to share.
          </li>
        </ul>

        <h2>Acceptable use</h2>
        <ul>
          <li>
            Don&rsquo;t upload documents you don&rsquo;t have rights to process (someone
            else&rsquo;s closing disclosure, for example).
          </li>
          <li>
            Don&rsquo;t use the Service to violate any law, including tax law — the output is a
            planning tool, not a license to file aggressively.
          </li>
          <li>
            Don&rsquo;t reverse-engineer, resell, or rebrand the Service without a written agreement
            with us.
          </li>
          <li>
            Don&rsquo;t submit automated or abusive traffic. We rate-limit and will block offenders.
          </li>
        </ul>

        <h2>Payment</h2>
        <ul>
          <li>All transactions are processed by Stripe. We never see or store your card number.</li>
          <li>Prices are per property and displayed at checkout in USD.</li>
          <li>
            <strong>Refund policy.</strong> DIY and AI Report: full refund within 7 days of delivery
            if you&rsquo;re not satisfied, no questions asked. Engineer-Reviewed: full refund before
            the engineer begins review; prorated refund after review starts based on work completed.
            Pipeline failures (we couldn&rsquo;t produce a usable report) are always fully refunded.
          </li>
          <li>Upgrades reuse your existing submissions; you pay the price delta only.</li>
        </ul>

        <h2>Ownership</h2>
        <ul>
          <li>
            <strong>Your data stays yours.</strong> You own the property facts you enter, the
            documents you upload, and the generated studies. You grant us a limited license to
            process them solely to deliver the Service.
          </li>
          <li>
            <strong>Our software stays ours.</strong> The app, the methodology library, the
            classification logic, the MACRS tables, the PDF templates, and the brand — all remain
            our property. Your subscription does not transfer any IP.
          </li>
        </ul>

        <h2>Warranty disclaimer</h2>
        <p>
          The Service is provided &ldquo;as is.&rdquo; We use reasonable care to make reports
          accurate and IRS-methodology-aligned, but we don&rsquo;t warrant that any specific filing
          outcome will result. AI classifications are probabilistic; engineer review is the
          defensible tier. Your CPA still needs to review every report before filing.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the extent permitted by law, our liability for any claim arising out of the Service is
          limited to the amount you paid for the affected study. We are not liable for consequential
          damages, lost tax benefits, examination outcomes, penalties, or interest assessments.
          Engineer-Reviewed studies additionally carry the reviewing engineer&rsquo;s professional
          liability coverage for the scope of their review.
        </p>

        <h2>Indemnification</h2>
        <p>
          You agree to indemnify and hold us harmless from third-party claims arising out of
          documents you upload that you didn&rsquo;t have rights to, or from use of the Service in
          violation of these terms.
        </p>

        <h2>Termination</h2>
        <p>
          You can close your account at any time by emailing{" "}
          <span className="font-mono">support@costseg.app</span>. We may suspend or terminate
          accounts that violate acceptable use, with notice where practical. Delivered studies
          remain yours; you&rsquo;ll get a 30-day window to export them before we honor any deletion
          request.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the State of California, USA, without regard to
          conflict-of-laws principles. Any dispute will be resolved in the state or federal courts
          located in San Francisco County, California. Nothing here prevents either party from
          seeking injunctive relief for IP infringement.
        </p>

        <h2>Changes</h2>
        <p>
          We&rsquo;ll post material changes to these terms here 30 days before they take effect and
          email everyone on the customer list.
        </p>

        <h2>Contact</h2>
        <p>
          Questions, complaints, or weird legal requests?{" "}
          <span className="font-mono">legal@costseg.app</span>.
        </p>
      </div>
    </Container>
  );
}
