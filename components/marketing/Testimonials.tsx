import { QuoteIcon } from "lucide-react";

import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const QUOTES: Array<{
  quote: string;
  author: string;
  role: string;
  numbers: { label: string; value: string };
}> = [
  {
    quote:
      "I&rsquo;ve paid $3,500 for studies that took six weeks. This one was in my inbox before my coffee got cold. My CPA had no notes.",
    author: "Sam R.",
    role: "STR investor · Austin, TX",
    numbers: { label: "Year-1 deduction", value: "$147k" },
  },
  {
    quote:
      "The per-asset rationale is the difference. I can show my accountant why a towel bar is 5-year property and link it straight to the line item.",
    author: "Derek M.",
    role: "Small multifamily · Denver, CO",
    numbers: { label: "Report turnaround", value: "11 min" },
  },
  {
    quote:
      "We onboarded four clients in one afternoon. Segra is the first tool my firm hasn&rsquo;t had to explain to clients. They actually get it.",
    author: "Priya K., CPA",
    role: "Two-partner firm · Tampa, FL",
    numbers: { label: "Clients onboarded", value: "4 in 1 afternoon" },
  },
];

export function Testimonials() {
  return (
    <Section>
      <Container size="xl">
        <SectionHeader
          eyebrow="Illustrative · pre-launch"
          title="The shape of the feedback we're hearing."
          description="These are composite scenarios from beta-program interviews, not verbatim quotes from named customers. We'll replace them with real, verifiable reviews as soon as we can."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {QUOTES.map((q) => (
            <Card key={q.author} className="h-full">
              <CardContent className="flex h-full flex-col p-7">
                <QuoteIcon className="text-primary/40 h-6 w-6" aria-hidden />
                <p
                  className="mt-4 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: q.quote }}
                />
                <div className="mt-auto space-y-4 pt-6">
                  <Badge variant="muted" size="sm">
                    {q.numbers.label}: {q.numbers.value}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{q.author}</p>
                    <p className="text-muted-foreground text-xs">{q.role} · illustrative</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
