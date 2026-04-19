import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Terms of service"
        description="The short version: use it well, and we owe you the report."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <p className="text-muted-foreground text-sm">
          Effective {new Date().toLocaleDateString()}.
        </p>
        <h2>Scope</h2>
        <p>
          Cost Seg provides software-generated modeling reports and, for Tier-2 studies,
          engineer-reviewed, signed cost segregation studies. We are not your tax advisor. Every
          report includes the scope disclosure under IRS Pub 5653.
        </p>
        <h2>Payment</h2>
        <p>
          All transactions are processed by Stripe. Refunds available within 7 days of delivery for
          Tier-1 reports; Tier-2 refunds subject to engineer-review state (see dashboard).
        </p>
        <h2>Limitation of liability</h2>
        <p>
          We are liable up to the amount you paid for the affected study. We are not liable for
          consequential tax outcomes, penalties, or examination results. Engineer-Reviewed studies
          carry the reviewing engineer&rsquo;s professional liability coverage.
        </p>
        <h2>Acceptable use</h2>
        <p>
          Don&rsquo;t upload property documents that aren&rsquo;t yours or that you don&rsquo;t have
          rights to process.
        </p>
        <h2>Changes</h2>
        <p>We&rsquo;ll post material changes here 30 days before they take effect.</p>
      </div>
    </Container>
  );
}
