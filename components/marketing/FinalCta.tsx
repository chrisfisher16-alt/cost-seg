import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  return (
    <section className="border-border/60 relative mt-24 overflow-hidden border-t py-20">
      <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />
      <Container size="md" className="text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Make filing day feel easy.
        </h2>
        <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg leading-relaxed">
          Three inputs, a year-one deduction, and a branded PDF — in the time it takes to make a
          pour-over. No sign-up required to estimate.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="xl" trailingIcon={<ArrowRightIcon />}>
            <Link href="/#estimator">Run my free estimate</Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
