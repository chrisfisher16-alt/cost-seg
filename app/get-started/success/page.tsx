import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, MailIcon } from "lucide-react";

import { BrandMark } from "@/components/shared/BrandMark";
import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  searchParams: Promise<{ session_id?: string }>;
};

export const metadata: Metadata = {
  title: "Payment received",
  description: "Your cost segregation study is queued. Check your email for a sign-in link.",
};

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main id="main-content" className="flex flex-1 flex-col">
      <header className="border-border/60 bg-background/60 border-b backdrop-blur">
        <Container size="xl" className="flex h-16 items-center">
          <BrandMark />
        </Container>
      </header>

      <div className="flex flex-1 items-center justify-center py-16">
        <Container size="sm">
          <Card className="border-primary/20 ring-primary/10 shadow-lg ring-1">
            <CardContent className="p-10 text-center">
              <div className="bg-success/10 text-success mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full">
                <CheckCircle2Icon className="h-7 w-7" aria-hidden />
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight">Payment received.</h1>
              <p className="text-muted-foreground mx-auto mt-3 max-w-md">
                We just sent a sign-in link to your inbox. Click it to continue, upload your three
                documents, and we&rsquo;ll kick off the pipeline.
              </p>

              <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
                <NextStep
                  n={1}
                  title="Check your email"
                  body="Sign-in link from Cost Seg — subject: 'Your sign-in link.'"
                />
                <NextStep
                  n={2}
                  title="Upload 3 documents"
                  body="Closing disclosure, improvement receipts, property photos."
                />
                <NextStep
                  n={3}
                  title="Watch the pipeline"
                  body="We show every step live. You&rsquo;ll get your PDF in minutes."
                />
              </div>

              {params.session_id ? (
                <p className="text-muted-foreground mt-8 font-mono text-[10px] tracking-[0.2em] uppercase">
                  Receipt ref {params.session_id.slice(-10)}
                </p>
              ) : null}

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
                  <Link href="/sign-in">Sign in to upload documents</Link>
                </Button>
                <Button asChild variant="outline" size="lg" leadingIcon={<MailIcon />}>
                  <a href="mailto:support@costseg.app">Need help?</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Container>
      </div>
    </main>
  );
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
