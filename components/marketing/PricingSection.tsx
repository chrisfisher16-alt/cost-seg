import Link from "next/link";
import { CheckIcon, ClockIcon, XCircleIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUDIT_PROTECTION_ADDON,
  MARKETING_TIERS,
  formatTierPrice,
  type MarketingTierEntry,
} from "@/lib/marketing/tiers";
import { cn } from "@/lib/utils";

export function PricingSection({ compact = false }: { compact?: boolean }) {
  return (
    <Section id="pricing">
      <Container size="xl">
        <SectionHeader
          eyebrow="Pricing"
          title="Pay for exactly the report you need."
          description="Start with a modeling report for planning. Upgrade to an engineer-signed study when you file — without re-uploading a single document."
        />

        {/* md:grid-cols-3 instead of lg: — at 1024px+ cards get generous
            space; at tablet (768-1024px) they're tight at ~224px each but
            the price/title/bullets all fit, and the alternative is a
            1400px vertical scroll on iPads. Matches the /samples gallery
            breakpoint for consistency. */}
        <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
          {MARKETING_TIERS.map((tier) => (
            <TierCard key={tier.id} tier={tier} />
          ))}
        </div>

        {!compact ? (
          <div className="border-border bg-muted/20 mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed p-6 sm:flex-row sm:text-left">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="muted" size="sm">
                  Add-on · Coming soon
                </Badge>
                <p className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
                  + {formatTierPrice(AUDIT_PROTECTION_ADDON.priceCents)}
                </p>
              </div>
              <p className="mt-2 text-base font-semibold">{AUDIT_PROTECTION_ADDON.label}</p>
              <p className="text-muted-foreground mt-1 text-sm">{AUDIT_PROTECTION_ADDON.blurb}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/pricing#audit-protection">See what&rsquo;s covered</Link>
            </Button>
          </div>
        ) : null}

        <p className="text-muted-foreground mt-10 text-center text-xs">
          Prices are per property. Bulk, CPA, and portfolio pricing available on request.
        </p>
      </Container>
    </Section>
  );
}

function TierCard({ tier }: { tier: MarketingTierEntry }) {
  const featured = tier.featured;
  return (
    <Card
      className={cn(
        "relative flex h-full flex-col transition",
        featured ? "border-primary/30 ring-primary/20 shadow-lg ring-1" : "hover:shadow-md",
      )}
    >
      {tier.badge ? (
        <span
          className={cn(
            "absolute top-4 right-4 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium tracking-[0.15em] uppercase",
            tier.badge.tone === "primary" && "bg-primary text-primary-foreground",
            tier.badge.tone === "accent" && "bg-accent text-accent-foreground",
            tier.badge.tone === "muted" && "bg-muted text-muted-foreground",
          )}
        >
          {tier.badge.label}
        </span>
      ) : null}
      <CardContent className="flex flex-1 flex-col p-7">
        <header className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide">{tier.tagline}</p>
          <h3 className="text-xl font-semibold tracking-tight">{tier.label}</h3>
        </header>

        <div className="mt-6 flex items-baseline gap-2">
          <p data-tabular className="text-4xl font-semibold tracking-tight">
            {formatTierPrice(tier.priceCents)}
          </p>
          <p className="text-muted-foreground text-xs">{tier.priceNote}</p>
        </div>

        <div className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
          <ClockIcon className="h-3.5 w-3.5" aria-hidden />
          <span>{tier.turnaround}</span>
        </div>

        <ul className="mt-6 space-y-3 text-sm">
          {tier.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2.5">
              <CheckIcon className="text-primary mt-[3px] h-4 w-4 shrink-0" aria-hidden />
              <span className="text-foreground/90 leading-relaxed">{bullet}</span>
            </li>
          ))}
          {tier.limitations?.map((limitation) => (
            <li key={limitation} className="text-muted-foreground flex gap-2.5">
              <XCircleIcon
                className="text-muted-foreground/60 mt-[3px] h-4 w-4 shrink-0"
                aria-hidden
              />
              <span className="leading-relaxed">{limitation}</span>
            </li>
          ))}
        </ul>

        <div className="bg-muted/40 mt-6 rounded-md p-3">
          <p className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
            Best for
          </p>
          <p className="text-foreground/80 mt-1 text-xs leading-relaxed">{tier.bestFor}</p>
        </div>

        <div className="mt-auto pt-7">
          <Button
            asChild
            variant={featured ? "default" : "outline"}
            size="lg"
            className="w-full"
            disabled={tier.comingSoon}
          >
            <Link href={tier.ctaHref as never}>{tier.ctaLabel}</Link>
          </Button>
          <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">{tier.footnote}</p>
        </div>
      </CardContent>
    </Card>
  );
}
