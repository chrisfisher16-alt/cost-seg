import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { DiyWaitlistForm } from "@/components/marketing/DiyWaitlistForm";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "For CPAs" };

export default function PartnersPage() {
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
            For CPAs and EAs
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Cost seg your clients ask for, finally done in an afternoon.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance">
            Invite your clients, collect their documents in-app, and review engineer-signed studies
            on your own dashboard. Revenue-share on every referral.
          </p>
        </Container>
      </section>

      <Section>
        <Container size="xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Client workspace",
                b: "One dashboard with all your clients, all their properties, and all their studies. Filter by status, flag by complexity.",
              },
              {
                t: "Read-only share",
                b: "Every client can invite you in one click. You see the pipeline in real time and comment on line items.",
              },
              {
                t: "Referral revenue-share",
                b: "Earn 15% on every study your clients complete through your link. Payout monthly.",
              },
            ].map((b) => (
              <Card key={b.t}>
                <CardContent className="p-6">
                  <p className="font-semibold">{b.t}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{b.b}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="muted">
        <Container size="md">
          <SectionHeader
            eyebrow="Early-access program"
            title="Join our CPA beta."
            description="We&rsquo;re onboarding 25 firms in 2026 Q2 to shape the partner surface. Get early access and a lifetime 20% revenue-share."
          />
          <div className="mt-10">
            <DiyWaitlistForm />
          </div>
        </Container>
      </Section>

      <Section>
        <Container size="md" className="text-center">
          <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
            <Link href="/pricing">See pricing</Link>
          </Button>
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}
