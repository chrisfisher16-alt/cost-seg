import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, MailIcon } from "lucide-react";

import { CheckoutSuccessClient } from "./CheckoutSuccessClient";
import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getOptionalAuth } from "@/lib/auth/require";
import { BRAND } from "@/lib/brand";
import { getPrisma } from "@/lib/db/client";
import { CATALOG, type Tier } from "@/lib/stripe/catalog";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export const metadata: Metadata = {
  title: "Payment received",
  description: "Your cost segregation study is queued. Check your email for a sign-in link.",
};

/**
 * Per-tier next-step cards. DIY doesn't upload documents — it's a basis
 * calculator — so the middle step changes wording + icon copy. Engineer-
 * Reviewed adds the 3-7 day signature line to set expectation.
 */
function nextStepsForTier(tier: Tier | null): Array<{ n: number; title: string; body: string }> {
  if (tier === "DIY") {
    return [
      {
        n: 1,
        title: "Check your email",
        body: "Sign-in link from Segra — subject: 'Your sign-in link.'",
      },
      {
        n: 2,
        title: "Enter your basis",
        body: "Purchase price, land value, acquired date. ~90 seconds, no documents needed.",
      },
      {
        n: 3,
        title: "Instant PDF",
        body: "Your MACRS schedule and branded report generate the moment you submit.",
      },
    ];
  }
  if (tier === "ENGINEER_REVIEWED") {
    return [
      {
        n: 1,
        title: "Check your email",
        body: "Sign-in link from Segra — subject: 'Your sign-in link.'",
      },
      {
        n: 2,
        title: "Upload 3 documents",
        body: "Closing disclosure, improvement receipts, property photos.",
      },
      {
        n: 3,
        title: "Engineer signs in 3–7 days",
        body: "AI draft in minutes, PE review and signature within a business week.",
      },
    ];
  }
  // Default: AI_REPORT (+ fallback when tier is unknown)
  return [
    {
      n: 1,
      title: "Check your email",
      body: "Sign-in link from Segra — subject: 'Your sign-in link.'",
    },
    {
      n: 2,
      title: "Upload 3 documents",
      body: "Closing disclosure, improvement receipts, property photos.",
    },
    {
      n: 3,
      title: "Watch the pipeline",
      body: "We show every step live. You'll get your PDF in minutes.",
    },
  ];
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId = params.session_id ?? null;

  // Try to resolve the created Study + tier. The webhook races against this
  // page — on a fast network the customer can land here before Stripe has
  // retried the webhook. Either path is fine; we fall through to the
  // generic copy when the Study row hasn't appeared yet.
  const [ctx, study] = await Promise.all([
    getOptionalAuth().catch(() => null),
    sessionId ? findStudyBySession(sessionId) : Promise.resolve(null),
  ]);
  const tier = study?.tier ?? null;
  const steps = nextStepsForTier(tier);

  // Signed-in buyer: skip the magic-link friction and hand them a direct
  // intake link. Only do this if we can prove ownership (the Study row's
  // userId matches the authenticated user).
  const signedInAndOwns = Boolean(ctx && study && study.userId === ctx.user.id);
  const intakeHref: Route | null = signedInAndOwns
    ? tier === "DIY"
      ? (`/studies/${study!.id}/diy` as Route)
      : (`/studies/${study!.id}/intake` as Route)
    : null;

  const tierLabel = tier ? CATALOG[tier].label : null;

  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <header className="border-border/60 bg-background/60 border-b backdrop-blur">
        <Container size="xl" className="flex h-16 items-center">
          <BrandMark />
        </Container>
      </header>

      <div className="flex flex-1 items-center justify-center py-16">
        <Container size="sm">
          <Card className="border-primary/20 ring-primary/10 shadow-lg ring-1 motion-safe:animate-[slide-in-from-bottom_400ms_cubic-bezier(0.22,1,0.36,1)]">
            <CardContent className="p-10 text-center">
              {/* Confetti burst on mount — matches the delivery celebration
                  moment. Respects prefers-reduced-motion internally. */}
              <CheckoutSuccessClient />

              <div className="bg-success/10 text-success mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full">
                <CheckCircle2Icon className="h-7 w-7" aria-hidden />
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">Payment received.</h1>
              {tierLabel ? (
                <div className="mt-3 flex justify-center">
                  <Badge variant={tier === "ENGINEER_REVIEWED" ? "success" : "default"} size="sm">
                    {tierLabel}
                  </Badge>
                </div>
              ) : null}
              <p className="text-muted-foreground mx-auto mt-3 max-w-md">
                {signedInAndOwns
                  ? "You're already signed in — head straight to intake whenever you're ready."
                  : "We just sent a sign-in link to your inbox. Click it to continue your study setup."}
              </p>

              <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
                {steps.map((step) => (
                  <NextStep key={step.n} n={step.n} title={step.title} body={step.body} />
                ))}
              </div>

              {sessionId ? (
                <p className="text-muted-foreground mt-8 font-mono text-[10px] tracking-[0.2em] uppercase">
                  Receipt ref {sessionId.slice(-10)}
                </p>
              ) : null}

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                {intakeHref ? (
                  <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
                    <Link href={intakeHref}>
                      {tier === "DIY" ? "Enter your basis" : "Start uploading"}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
                    <Link href="/sign-in">
                      {tier === "DIY" ? "Sign in to start" : "Sign in to upload"}
                    </Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="lg" leadingIcon={<MailIcon />}>
                  <a href={`mailto:${BRAND.email.support}`}>Email support</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Container>
      </div>
    </main>
  );
}

/**
 * Best-effort lookup. Never throws — if Prisma is unreachable or the row
 * isn't there yet, fall back to the tier-neutral copy.
 */
async function findStudyBySession(sessionId: string) {
  try {
    return await getPrisma().study.findUnique({
      where: { stripeSessionId: sessionId },
      select: { id: true, tier: true, userId: true },
    });
  } catch {
    return null;
  }
}

function NextStep({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="border-border bg-muted/20 rounded-lg border p-4">
      <p className="text-muted-foreground font-mono text-[10px] tracking-[0.2em] uppercase">
        Step {n}
      </p>
      <p className="mt-1.5 text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{body}</p>
    </div>
  );
}
