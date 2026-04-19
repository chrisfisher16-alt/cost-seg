import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, ClockIcon, ShieldCheckIcon } from "lucide-react";

import { GetStartedForm } from "@/components/marketing/GetStartedForm";
import { ScopeDisclosure } from "@/components/marketing/ScopeDisclosure";
import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getOptionalAuth } from "@/lib/auth/require";
import { CATALOG, formatCents, type Tier } from "@/lib/stripe/catalog";
import { isStripeConfigured } from "@/lib/stripe/client";

type Props = {
  searchParams: Promise<{ tier?: string; cancelled?: string }>;
};

function isTier(value: string | undefined): value is Tier {
  return value === "DIY" || value === "AI_REPORT" || value === "ENGINEER_REVIEWED";
}

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Start your DIY Self-Serve, AI Report, or Engineer-Reviewed cost segregation study. Secure Stripe checkout.",
};

const TIER_HIGHLIGHTS: Record<Tier, string[]> = {
  DIY: [
    "Self-serve — you enter basis + land value, we do the allocation",
    "Full 40-row MACRS schedule with half-year / mid-month conventions",
    "Branded PDF with methodology appendix (Cover, Exec Summary, Appendix A–D)",
    "Upgrade to AI Report or Engineer-Reviewed anytime without re-entering data",
  ],
  AI_REPORT: [
    "Modeling report delivered in minutes",
    "Downloadable branded PDF + exec summary",
    "Year-1 deduction + full MACRS projection",
    "Scope disclosure on every page",
  ],
  ENGINEER_REVIEWED: [
    "Everything in AI Report",
    "Licensed Professional Engineer review & signature",
    "13-element ATG compliance checklist",
    "Audit-defensible under IRS Pub 5653",
  ],
};

const TIER_TURNAROUNDS: Record<Tier, string> = {
  DIY: "Delivered instantly",
  AI_REPORT: "Delivered in minutes",
  ENGINEER_REVIEWED: "Delivered in 3–7 business days",
};

export default async function GetStartedPage({ searchParams }: Props) {
  const params = await searchParams;
  const tier = isTier(params.tier) ? params.tier : "AI_REPORT";
  const entry = CATALOG[tier];
  const ctx = await getOptionalAuth();

  return (
    <main className="flex-1">
      {/* Minimal checkout header — focused flow, no full nav */}
      <header className="border-border/60 bg-background/60 border-b backdrop-blur">
        <Container size="xl" className="flex h-16 items-center justify-between">
          <BrandMark />
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← Back to pricing
          </Link>
        </Container>
      </header>

      <Container size="xl" className="py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-8">
            <div>
              <Badge variant={tier === "ENGINEER_REVIEWED" ? "success" : "default"} size="sm">
                {entry.label}
              </Badge>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Start your {entry.label.toLowerCase()}.
              </h1>
              <p className="text-muted-foreground mt-2 text-base leading-relaxed">{entry.blurb}</p>
            </div>

            {params.cancelled === "1" ? (
              <Alert variant="warning">
                <AlertTitle>Checkout was cancelled.</AlertTitle>
                <AlertDescription>
                  No charge was made. Your form is preserved if you&rsquo;d like to try again.
                </AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardContent className="p-7">
                <GetStartedForm
                  tier={tier}
                  defaultEmail={ctx?.user.email}
                  stripeConfigured={isStripeConfigured()}
                />
              </CardContent>
            </Card>

            <ScopeDisclosure />
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardContent className="space-y-6 p-7">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
                      Total today
                    </p>
                    <p data-tabular className="mt-1 text-4xl font-semibold tracking-tight">
                      {formatCents(entry.priceCents)}
                    </p>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <ClockIcon className="h-3.5 w-3.5" aria-hidden />
                    <span>{TIER_TURNAROUNDS[tier]}</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium">What&rsquo;s included</p>
                  <ul className="mt-3 space-y-2.5 text-sm">
                    {TIER_HIGHLIGHTS[tier].map((h) => (
                      <li key={h} className="flex gap-2">
                        <CheckIcon className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span className="leading-relaxed">{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Report tier</dt>
                    <dd className="font-medium">{entry.label}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Turnaround</dt>
                    <dd className="font-medium">{TIER_TURNAROUNDS[tier]}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Scope</dt>
                    <dd className="font-medium">1 property</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="space-y-3 p-6">
                <ShieldCheckIcon className="text-primary h-5 w-5" aria-hidden />
                <p className="text-sm font-medium">Your documents stay private.</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Encrypted storage, signed-URL access, full audit trail. Only you and your assigned
                  engineer ever see them.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </Container>
    </main>
  );
}
