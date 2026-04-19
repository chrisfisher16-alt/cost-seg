import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Container } from "@/components/shared/Container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Everything about AI cost segregation — defensibility, STR loophole, bonus depreciation under OBBBA, turnaround, audit protection, and more.",
};

export default function FaqPage() {
  return (
    <>
      <section className="relative overflow-hidden pt-20 pb-6 sm:pt-28">
        <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
        <Container size="md" className="text-center">
          <Badge
            variant="outline"
            size="default"
            className="border-primary/30 bg-primary/5 text-primary mx-auto"
          >
            FAQ
          </Badge>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Answers, in plain English.
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-balance">
            Still have a question?{" "}
            <Link href="/contact" className="text-primary underline-offset-2 hover:underline">
              Email us
            </Link>{" "}
            — we answer every inquiry within one business day.
          </p>
        </Container>
      </section>
      <FaqSection />
      <Container size="md" className="pb-20 text-center">
        <Button asChild size="lg" trailingIcon={<ArrowRightIcon />}>
          <Link href="/pricing">See pricing</Link>
        </Button>
      </Container>
      <FinalCta />
    </>
  );
}
