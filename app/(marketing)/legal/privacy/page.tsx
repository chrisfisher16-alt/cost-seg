import type { Metadata } from "next";

import { Container } from "@/components/shared/Container";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <Container size="md" className="py-16 sm:py-24">
      <PageHeader
        title="Privacy policy"
        description="How we handle your data, in plain language."
      />
      <div className="prose prose-neutral dark:prose-invert mt-10 max-w-none">
        <p className="text-muted-foreground text-sm">
          Effective {new Date().toLocaleDateString()}.
        </p>
        <h2>What we collect</h2>
        <p>
          Account info (email, name), property records you submit, documents you upload (closing
          disclosures, receipts, photos), and standard usage analytics. We do not sell or rent any
          of it.
        </p>
        <h2>How we use it</h2>
        <p>
          Solely to deliver your cost segregation reports, provide engineer review, and support your
          account.
        </p>
        <h2>Storage</h2>
        <p>
          Encrypted at rest on Supabase Storage. Signed-URL access only. Source documents retained
          for 7 years to support audit defense; reports retained as long as your account is active.
        </p>
        <h2>Sub-processors</h2>
        <p>
          Supabase (storage/auth), Stripe (payments), Resend (email), Anthropic (AI inference),
          Vercel (hosting), Sentry (error monitoring), PostHog (analytics).
        </p>
        <h2>Your rights</h2>
        <p>
          Request deletion, export, or correction at any time via{" "}
          <span className="font-mono">privacy@costseg.app</span>.
        </p>
      </div>
    </Container>
  );
}
