import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/shared/Container";
import { Section } from "@/components/shared/Section";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "About",
  description: `${BRAND.name} builds AI-powered cost segregation studies for real estate investors. Here's the why, the how, and where the name came from.`,
};

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-20 pb-10 sm:pt-28">
        <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
        <Container size="md" className="text-center">
          <p className="text-muted-foreground mb-4 font-mono text-xs tracking-widest uppercase">
            About {BRAND.name}
          </p>
          <h1 className="text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Cost segregation, without the six-week wait.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-balance">
            {BRAND.name} is software for real estate investors who are tired of leaving tens of
            thousands of dollars on the table every April.
          </p>
        </Container>
      </section>

      <Section>
        <Container size="md">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <h2>What we do</h2>
            <p>
              A cost segregation study reclassifies the components of a property — flooring,
              cabinetry, specialty electrical, land improvements, and more — out of the default
              27.5-year (residential) or 39-year (commercial) depreciation schedule and into 5-, 7-,
              and 15-year buckets. Those shorter buckets qualify for 100% bonus depreciation, which
              was permanently restored under the 2025 One Big Beautiful Bill Act. The result: tens
              of thousands of dollars in year-one tax savings on a property most CPAs would have
              depreciated over three decades by default.
            </p>
            <p>
              Traditionally, a study costs $5,000 to $15,000 and takes an engineering firm four to
              six weeks to produce. {BRAND.name} runs the same analysis in minutes using AI and a
              purpose-built rules engine, delivering a planning-grade AI Report for a few hundred
              dollars, or an engineer-reviewed, audit-defensible study in three to seven days for a
              fraction of the traditional cost.
            </p>

            <h2>Where the name comes from</h2>
            <p>
              {BRAND.name} is from the Latin <em>segregare</em> — &ldquo;to set apart&rdquo; — the
              same root as the word segregate. That verb is the literal job description of the
              product: we set apart the parts of a property that can be depreciated quickly from the
              ones that can&rsquo;t, at a speed that software finally makes possible.
            </p>
            <p>
              We picked a coined name rather than a descriptive one because this space is crowded
              with interchangeable brands (DIY Cost Seg, CostSegregation.com, Cost Seg EZ,
              CostSegSmart) and we wanted a name that could travel. {BRAND.name} works for
              today&rsquo;s product and for the broader real-estate tax toolkit we intend to build
              around it.
            </p>

            <h2>Who this is for</h2>
            <p>
              Short-term-rental hosts with 1+ properties. Small-multifamily operators. Single-family
              rental investors who qualify for Real Estate Professional Status or the short-term
              rental exception. Syndicators looking to hand LPs a cleaner first-year tax position.
              And the CPAs who advise them — we&rsquo;re building a white-label program for CPA
              firms who want to offer cost seg to their existing book without hiring engineering
              staff.
            </p>

            <h2>How we work</h2>
            <p>
              You upload three documents: a closing disclosure, any improvement receipts, and a few
              property photos. Our AI pipeline normalizes the documents, allocates purchase price
              between land and building, classifies building basis into the correct IRS depreciation
              categories against a property-type-specific asset library, and generates a branded
              report your CPA can paste directly into their tax software. Every Tier 2
              Engineer-Reviewed Study is then reviewed and signed by a US-licensed professional
              engineer before it&rsquo;s delivered to you.
            </p>
            <p>
              We are deliberately transparent about what each tier is and isn&rsquo;t. The AI Report
              is a planning and modeling tool. The Engineer-Reviewed Study is audit-defensible. We
              never let someone buy the wrong product by accident.
            </p>

            <h2>Who we are</h2>
            <p>
              {BRAND.name} is built by a small team of real estate investors and software engineers
              who got tired of watching friends overpay the IRS. We operate lean and ship fast — and
              we aren&rsquo;t a big firm pretending to be small software. We&rsquo;re actual
              software.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/#estimator">Estimate your savings</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
