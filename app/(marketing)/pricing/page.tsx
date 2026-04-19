import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "lucide-react";

import { DiyWaitlistForm } from "@/components/marketing/DiyWaitlistForm";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { PricingSection } from "@/components/marketing/PricingSection";
import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AUDIT_PROTECTION_ADDON, formatTierPrice } from "@/lib/marketing/tiers";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "DIY Self-Serve ($149), AI Report ($295), or Engineer-Reviewed study ($1,495). No hidden fees. Upgrade paths without re-uploading.",
};

export default function PricingPage() {
  return (
    <>
      <PricingHero />
      <PricingSection compact />
      <AuditProtectionBlock />
      <DiyWaitlistBlock />
      <PricingFaqBridge />
      <FaqSection limit={5} />
      <FinalCta />
    </>
  );
}

function PricingHero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-6 sm:pt-28">
      <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
      <Container size="md" className="text-center">
        <Badge
          variant="outline"
          size="default"
          className="border-primary/30 bg-primary/5 text-primary mx-auto"
        >
          Pricing
        </Badge>
        <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
          Three tiers. Zero surprises.
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg leading-relaxed text-balance">
          Pay for exactly what your property needs. Every upgrade reuses what you already submitted.
        </p>
      </Container>
    </section>
  );
}

function AuditProtectionBlock() {
  return (
    <Section id="audit-protection" tone="muted">
      <Container size="xl">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-4">
            <Badge variant="muted" size="sm">
              Add-on · Coming 2026 Q3
            </Badge>
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {AUDIT_PROTECTION_ADDON.label}
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              {AUDIT_PROTECTION_ADDON.blurb}
            </p>
            <p
              data-tabular
              className="brand-gradient-text text-5xl font-semibold tracking-tight sm:text-6xl"
            >
              +{formatTierPrice(AUDIT_PROTECTION_ADDON.priceCents)}
            </p>
            <p className="text-muted-foreground text-xs">
              Per property, one-time. Covers for the life of the depreciation schedule.
            </p>
          </div>
          <Card>
            <CardContent className="p-7">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <ShieldCheckIcon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight">What&rsquo;s covered</p>
                  <p className="text-muted-foreground text-sm">
                    A credentialed pro defends your study — not just a help-desk response.
                  </p>
                </div>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {AUDIT_PROTECTION_ADDON.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2.5">
                    <CheckIcon className="text-primary mt-[3px] h-4 w-4 shrink-0" aria-hidden />
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
              <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
                {AUDIT_PROTECTION_ADDON.footnote}
              </p>
              <Button className="mt-6" variant="outline" disabled>
                Join the waitlist (launching 2026 Q3)
              </Button>
            </CardContent>
          </Card>
        </div>
      </Container>
    </Section>
  );
}

function DiyWaitlistBlock() {
  return (
    <Section id="diy-waitlist">
      <Container size="md">
        <SectionHeader
          eyebrow="DIY Self-Serve · early access"
          title="Be first when the $149 self-serve tier launches."
          description="Day-2 on our roadmap. We&rsquo;ll email you the moment it&rsquo;s live — and the first 100 signups get their first property free."
        />
        <div className="mt-10">
          <DiyWaitlistForm />
        </div>
      </Container>
    </Section>
  );
}

function PricingFaqBridge() {
  return (
    <Section>
      <Container size="md" className="text-center">
        <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Not sure which tier you need?
        </h3>
        <p className="text-muted-foreground mt-3 text-base">
          A 30-second estimate usually makes the answer obvious.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
            <Link href="/#estimator">Run the estimator</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/compare">Compare providers</Link>
          </Button>
        </div>
      </Container>
    </Section>
  );
}
