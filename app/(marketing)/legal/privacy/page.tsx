import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Privacy" };

const EFFECTIVE = "April 19, 2026";

export default function PrivacyPage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Privacy policy"
        description="How we handle your data, in plain language."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <p className="text-muted-foreground text-sm">Effective {EFFECTIVE}.</p>

        <h2>Who we are</h2>
        <p>
          Segra is operated by the product team at <strong>Segra</strong> (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;). Privacy questions go to{" "}
          <span className="font-mono">privacy@segra.tax</span>. If you&rsquo;d rather write: use
          that email to request a mailing address.
        </p>

        <h2>What we collect</h2>
        <p>We only collect what&rsquo;s necessary to run the product:</p>
        <ul>
          <li>
            <strong>Account info</strong> — email address, optional display name, the Supabase auth
            session token that signs you in.
          </li>
          <li>
            <strong>Property records</strong> — addresses, purchase prices, acquisition dates,
            property types, and anything else you enter through the intake flow.
          </li>
          <li>
            <strong>Documents you upload</strong> — closing disclosures, improvement receipts,
            property photos, and any other source documents you submit for AI extraction or engineer
            review.
          </li>
          <li>
            <strong>Study outputs</strong> — the generated asset schedule, methodology narrative,
            PDF reports, and Form 3115 worksheets.
          </li>
          <li>
            <strong>Payment metadata</strong> — Stripe customer and payment-intent IDs, tier paid,
            amount. We do <em>not</em> store card numbers; Stripe does.
          </li>
          <li>
            <strong>Usage analytics</strong> — anonymized page views and product events for
            debugging and product research. No cross-site tracking.
          </li>
          <li>
            <strong>Support correspondence</strong> — emails you send us stay in the thread; we
            don&rsquo;t mine them for unrelated purposes.
          </li>
        </ul>

        <h2>What we don&rsquo;t collect</h2>
        <ul>
          <li>Credit-card numbers (Stripe handles those; we never see them).</li>
          <li>Social Security numbers or tax IDs (we don&rsquo;t ask, don&rsquo;t want them).</li>
          <li>Your location beyond the property address you explicitly type in.</li>
        </ul>

        <h2>How we use it</h2>
        <p>
          Strictly to deliver the product: run your AI pipeline, route your study to the right
          engineer, generate your PDF, email you when it&rsquo;s ready, and let your CPA see the
          result if you share it. We also use anonymized analytics to fix bugs and figure out which
          features get used. <strong>We do not sell, rent, or swap your data.</strong>
        </p>

        <h2>Sub-processors</h2>
        <p>
          We use third-party services to operate the product. Your data passes through these, so
          they get named here:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — authentication, Postgres database, encrypted object storage.
          </li>
          <li>
            <strong>Vercel</strong> — web hosting and edge functions.
          </li>
          <li>
            <strong>Anthropic</strong> — the Claude AI model that reads your documents and
            classifies assets. Source documents are sent via Anthropic&rsquo;s API; per their terms,
            inputs are not used to train Anthropic&rsquo;s models.
          </li>
          <li>
            <strong>AWS Textract</strong> — OCR for document parsing (AWS Sub-processor).
          </li>
          <li>
            <strong>Stripe</strong> — payments processing.
          </li>
          <li>
            <strong>Resend</strong> — transactional email (your delivery emails, share invites,
            magic links).
          </li>
          <li>
            <strong>Inngest</strong> — durable background job execution for the AI pipeline.
          </li>
          <li>
            <strong>Sentry</strong> — error monitoring. We scrub stack traces for PII before
            indexing.
          </li>
          <li>
            <strong>PostHog</strong> — product analytics. Events are tied to hashed user IDs, not
            email addresses.
          </li>
        </ul>

        <h2>Storage &amp; security</h2>
        <p>
          Everything is encrypted at rest on Supabase Storage and encrypted in transit via TLS 1.2+.
          Source documents are served exclusively through short-lived signed URLs — there is no
          public bucket. Access is gated by your Supabase session cookie; the only other humans who
          can see your files are an assigned engineer (Tier 2 only) and the on-call admin responding
          to a support ticket you opened.
        </p>

        <h2>Retention</h2>
        <ul>
          <li>
            <strong>Source documents</strong> — 7 years from delivery, to support audit defense
            under the IRS statute of limitations on the affected returns.
          </li>
          <li>
            <strong>Study outputs (PDFs, asset schedules, Form 3115 worksheets)</strong> — as long
            as your account is active, plus 1 year after closure.
          </li>
          <li>
            <strong>Account metadata</strong> — until you ask us to delete it. We keep minimal
            records of Stripe transactions for 7 years for tax-compliance reasons.
          </li>
          <li>
            <strong>Analytics</strong> — 24 months, then rolled up into anonymous aggregates.
          </li>
        </ul>

        <h2>Your rights</h2>
        <p>Regardless of where you live, we honor these rights on request:</p>
        <ul>
          <li>
            <strong>Access</strong> — ask us for a copy of everything we hold about you.
          </li>
          <li>
            <strong>Correction</strong> — tell us to fix anything inaccurate.
          </li>
          <li>
            <strong>Deletion</strong> — ask us to delete your account and data. We retain only what
            we&rsquo;re legally required to keep (payment records, audit-statute-bound documents if
            requested).
          </li>
          <li>
            <strong>Portability</strong> — a machine-readable export of your studies (JSON + PDFs).
          </li>
          <li>
            <strong>Opt-out of analytics</strong> — reply to any email or email us; we&rsquo;ll
            exclude your account from product analytics.
          </li>
        </ul>
        <p>
          Email <span className="font-mono">privacy@segra.tax</span> and we&rsquo;ll respond within
          30 days. California residents: this includes the rights granted under the CCPA and CPRA.
        </p>

        <h2>Automated decisions</h2>
        <p>
          Our AI pipeline classifies each asset into a MACRS class using a Claude model and the
          methodology described on the <a href="/legal/methodology">methodology page</a>. Every
          decision is shown in the PDF with its rationale. You can always request a human-reviewed
          (Tier 2) study instead, and the engineer has final authority over classifications.
        </p>

        <h2>Children</h2>
        <p>
          Segra is for adult real-estate owners and tax professionals. We don&rsquo;t knowingly
          collect data from anyone under 18.
        </p>

        <h2>Data breach</h2>
        <p>
          If we ever experience a breach that affects your data, we&rsquo;ll notify you by email
          within 72 hours of confirming it — including what was exposed, what we&rsquo;re doing
          about it, and what you should do.
        </p>

        <h2>Changes</h2>
        <p>
          We&rsquo;ll post material changes here 30 days before they take effect and email everyone
          on the customer list.
        </p>
      </div>
    </Container>
  );
}
