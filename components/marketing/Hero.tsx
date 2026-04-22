import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
      <div className="bg-grid bg-grid-fade absolute inset-0 -z-10" aria-hidden />
      <div className="brand-gradient-bg absolute inset-0 -z-10" aria-hidden />

      <Container size="lg" className="text-center">
        <Badge
          variant="outline"
          size="default"
          className="border-primary/30 bg-primary/5 text-primary mx-auto"
        >
          <SparklesIcon className="h-3 w-3" />
          <span>100% bonus depreciation restored under the OBBBA</span>
        </Badge>

        <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl md:text-7xl">
          Cost segregation studies,{" "}
          <span className="brand-gradient-text">without the six-week wait.</span>
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-balance sm:text-xl">
          Turn your real-estate basis into year-one tax deductions. Modeling reports in under 30
          minutes. Engineer-signed, audit-defensible studies in days. At a fraction of the
          traditional $5,000+ engagement.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="xl" trailingIcon={<ArrowRightIcon />}>
            <Link href="#estimator">Estimate your savings for free</Link>
          </Button>
          <Button asChild size="xl" variant="outline">
            <Link href="/pricing">Start a study</Link>
          </Button>
        </div>

        <p className="text-muted-foreground mt-5 text-xs">
          No signup to estimate. Payment only when you start a real study.
        </p>
      </Container>

      <Container size="lg" className="mt-16 sm:mt-24">
        <HeroProof />
      </Container>
    </section>
  );
}

function HeroProof() {
  const stats: Array<{ label: string; value: string; hint: string }> = [
    { label: "Avg year-1 deduction", value: "$92k", hint: "On a $500k STR basis" },
    { label: "Traditional turnaround", value: "6 weeks", hint: "We do it in 30 minutes to 7 days" },
    { label: "Traditional cost", value: "$5,000+", hint: "We start at $149" },
    { label: "IRS guidelines followed", value: "Pub 5653", hint: "ATG-compliant methodology" },
  ];
  return (
    <div className="border-border bg-card/60 relative overflow-hidden rounded-2xl border p-6 shadow-sm backdrop-blur sm:p-8">
      <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
              {s.label}
            </dt>
            <dd data-tabular className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {s.value}
            </dd>
            <p className="text-muted-foreground mt-1 text-xs">{s.hint}</p>
          </div>
        ))}
      </dl>
    </div>
  );
}
