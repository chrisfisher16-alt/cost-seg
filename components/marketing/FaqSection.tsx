import Link from "next/link";

import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BRAND } from "@/lib/brand";

export const FAQ_ITEMS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "Is an AI-generated cost segregation report IRS-defensible?",
    a: (
      <>
        <p>
          An AI-generated modeling report is a planning tool. It gives you accurate numbers for tax
          projection and CPA conversations, but it is <strong>not</strong> an engineered cost
          segregation study signed by a Professional Engineer under IRS Publication 5653.
        </p>
        <p className="mt-2">
          For filing, especially on larger bases or anything you&rsquo;d defend in an audit, upgrade
          to our Engineer-Reviewed tier. We re-use every document and data point, so you&rsquo;re
          not paying twice for the same work.
        </p>
      </>
    ),
  },
  {
    q: "How does this compare to CostSegregation.com, Cost Seg EZ, Segtax, or FIXR.ai?",
    a: (
      <>
        <p>
          We lead on two things: transparency of the AI (you see every step and every rationale) and
          report depth (our Tier-1 PDF rivals studies that normally cost $700+). We&rsquo;re roughly
          half the price of the nearest comparable tier.
        </p>
        <p className="mt-2">
          See our{" "}
          <Link href="/compare" className="text-primary underline-offset-2 hover:underline">
            full comparison page
          </Link>{" "}
          for a feature-by-feature grid, sourced to each provider&rsquo;s public site.
        </p>
      </>
    ),
  },
  {
    q: "What documents do I need to upload?",
    a: (
      <>
        <p>Three things, plus optional extras:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Closing disclosure</strong> (ALTA Settlement Statement or HUD-1). We extract the
            purchase price, date, title fees, and allocations automatically.
          </li>
          <li>
            <strong>Improvement receipts.</strong> Any capital expenditures since acquisition.
          </li>
          <li>
            <strong>Property photos.</strong> Interior and exterior. More photos means a richer
            schedule.
          </li>
          <li>Optional: appraisal, property management invoices, insurance declarations.</li>
        </ul>
      </>
    ),
  },
  {
    q: "What about bonus depreciation in 2026?",
    a: (
      <>
        <p>
          Under the One Big Beautiful Bill Act (OBBBA),{" "}
          <strong>100% bonus depreciation is restored</strong> for qualifying property placed in
          service on or after January 19, 2025. Our schedule checks your acquisition and
          placed-in-service dates against TCJA cutoffs (September 28, 2017) and OBBBA eligibility
          automatically.
        </p>
      </>
    ),
  },
  {
    q: "Can I use this for a short-term rental (Airbnb / VRBO)?",
    a: (
      <>
        <p>
          Yes. Short-term rentals are one of the highest-leverage use cases. If the average guest
          stay is under 7 days and you materially participate, the STR loophole lets non-real-estate
          professionals use the accelerated depreciation against active income. We explicitly
          support this workflow and generate the schedule classes needed.
        </p>
      </>
    ),
  },
  {
    q: "How long does the Engineer-Reviewed study actually take?",
    a: (
      <>
        <p>
          3–7 business days from the moment your AI Report is complete. The engineer reviews every
          line item, checks our classification decisions against the Whiteco and HCA tests,
          completes the 13-element ATG compliance checklist, and signs the report. Most studies land
          on day 4.
        </p>
      </>
    ),
  },
  {
    q: "Can I upgrade from AI Report to Engineer-Reviewed later?",
    a: (
      <>
        <p>
          Yes. One click from your dashboard. We reuse all of your documents, pipeline outputs, and
          classifications. You only pay the delta between the two tiers.
        </p>
      </>
    ),
  },
  {
    q: "What if the IRS audits me?",
    a: (
      <>
        <p>
          Engineer-Reviewed studies are designed to defend themselves under IRS Publication 5653.
          For additional peace of mind, our upcoming <strong>Lifetime Audit Protection</strong>{" "}
          add-on puts a licensed CPA or Enrolled Agent on retainer to represent you through the
          exam, for the life of the depreciation schedule.
        </p>
      </>
    ),
  },
  {
    q: "Do you store my data forever?",
    a: (
      <>
        <p>
          We store your study outputs as long as your account is active so you can access them any
          time. Source documents are retained for 7 years to support audit defense, then purged. You
          can request deletion at any time via support.
        </p>
      </>
    ),
  },
];

export function FaqSection({ limit }: { limit?: number }) {
  const items = typeof limit === "number" ? FAQ_ITEMS.slice(0, limit) : FAQ_ITEMS;
  return (
    <Section id="faq">
      <Container size="md">
        <SectionHeader
          eyebrow="FAQ"
          title="Answers to the questions we get most."
          description={`Missing something? Write to ${BRAND.email.support}. We answer every email within one business day.`}
        />
        <div className="border-border bg-card mt-10 rounded-2xl border p-2 sm:p-4">
          <Accordion type="single" collapsible className="w-full">
            {items.map((item, idx) => (
              <AccordionItem key={idx} value={`faq-${idx}`} className="px-4">
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        {limit && FAQ_ITEMS.length > limit ? (
          <p className="mt-6 text-center text-sm">
            <Link
              href="/faq"
              className="text-primary font-medium underline-offset-2 hover:underline"
            >
              See all {FAQ_ITEMS.length} questions →
            </Link>
          </p>
        ) : null}
      </Container>
    </Section>
  );
}
