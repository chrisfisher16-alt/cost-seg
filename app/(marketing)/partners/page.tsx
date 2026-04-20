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
            Cost seg your clients ask for, without the six-week waiting game.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance">
            Your clients get a planning report in minutes and an engineer-signed study in days.
            Read-only share-a-study lets them bring you in with one click — you see the same
            schedule and methodology they do. Revenue-share program coming as we scale the partner
            network.
          </p>
        </Container>
      </section>

      <Section>
        <Container size="xl">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                t: "Client workspace",
                b: "Every study a client shares with you shows up on your dashboard under a dedicated 'Shared with you' section. Same schedule, same methodology, same PDF they have.",
              },
              {
                t: "Read-only share",
                b: "Your client hits one button and you get an email. Click through, sign in, and you're looking at the full study — no new account for them to manage.",
              },
              {
                t: "Portfolio CSV export",
                b: "Pull every client study into a single CSV: year-1 deduction, accelerated basis, tax savings, line-item count. Paste straight into your workpapers.",
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
