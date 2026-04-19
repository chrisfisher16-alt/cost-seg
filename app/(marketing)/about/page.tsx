import type { Metadata } from "next";
import Link from "next/link";

import { FinalCta } from "@/components/marketing/FinalCta";
import { Container } from "@/components/shared/Container";
import { Section } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-20 pb-10 sm:pt-28">
        <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
        <Container size="md" className="text-center">
          <Badge
            variant="outline"
            size="default"
            className="border-primary/30 bg-primary/5 text-primary mx-auto"
          >
            About
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Trust infrastructure for real-estate tax.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance">
            Cost segregation has been dominated by $5,000 engagements with six-week turnarounds. We
            believe AI + a licensed engineer on review can deliver the same (often better) result in
            minutes to days, at a fraction of the cost — without compromising on IRS defensibility.
          </p>
        </Container>
      </section>

      <Section>
        <Container size="md">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <h2>Why now</h2>
            <p>
              The One Big Beautiful Bill Act (OBBBA) restored 100% bonus depreciation for qualifying
              property placed in service on or after January 19, 2025. That makes cost segregation
              the single highest-leverage tax move available to US real-estate investors.
            </p>
            <h2>Our approach</h2>
            <p>
              Every report follows IRS Publication 5653 methodology — Residual Estimation combined
              with Replacement Cost New Less Depreciation (RCNLD), backed by Rev. Proc. 87-56 asset
              classes and Treasury Reg. §1.167(a)-1 depreciation rules. Our AI does the extraction
              and classification. A licensed Professional Engineer reviews and signs when
              you&rsquo;re filing.
            </p>
            <h2>Principles</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                t: "Show the math",
                b: "Every number traces back to a source document and an assumption you can inspect.",
              },
              {
                t: "Trust the engineer",
                b: "AI accelerates; a licensed PE signs. No black-box numbers on a filed return.",
              },
              {
                t: "Respect the CPA",
                b: "Our second user is the accountant. Share, rollup, export — all first-class.",
              },
              {
                t: "Speed without corner-cutting",
                b: "Minutes matter. So does the 13-element ATG checklist.",
              },
            ].map((p) => (
              <Card key={p.t}>
                <CardContent className="p-5">
                  <p className="font-semibold">{p.t}</p>
                  <p className="text-muted-foreground mt-1 text-sm">{p.b}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-10">
            <Button asChild size="lg">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </Container>
      </Section>
      <FinalCta />
    </>
  );
}
