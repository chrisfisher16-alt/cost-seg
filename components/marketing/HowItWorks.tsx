import { FileTextIcon, SparklesIcon, UploadCloudIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    n: "01",
    icon: FileTextIcon,
    title: "Tell us about the property",
    body: "Address, purchase price, and property type — 90 seconds. No account needed for the free estimate.",
  },
  {
    n: "02",
    icon: UploadCloudIcon,
    title: "Upload three documents",
    body: "Closing disclosure, improvement receipts, and a few property photos. We extract what we need automatically.",
  },
  {
    n: "03",
    icon: SparklesIcon,
    title: "Watch the pipeline work — live",
    body: "See every step in real time: document parsing, basis decomposition, asset classification, narrative drafting. You get a branded PDF the moment it finishes.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <Container size="xl">
        <SectionHeader
          eyebrow="How it works"
          title="From purchase price to year-one deductions, in plain view."
          description="Built for owners of short-term rentals, small multifamily, and commercial real estate — and the CPAs who file for them."
        />
        <ol className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n}>
              <Card className="group h-full transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-7">
                  <div className="flex items-center justify-between">
                    <div className="bg-primary/10 text-primary inline-flex h-11 w-11 items-center justify-center rounded-lg">
                      <step.icon className="h-5 w-5" aria-hidden />
                    </div>
                    <span className="text-muted-foreground font-mono text-xs tracking-[0.2em]">
                      STEP {step.n}
                    </span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
