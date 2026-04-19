import { Estimator } from "@/components/marketing/Estimator";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { PlatformPreview } from "@/components/marketing/PlatformPreview";
import { PricingSection } from "@/components/marketing/PricingSection";
import { SampleReportPreview } from "@/components/marketing/SampleReportPreview";
import { Testimonials } from "@/components/marketing/Testimonials";
import { TrustStrip } from "@/components/marketing/TrustStrip";
import { Container } from "@/components/shared/Container";
import { Section, SectionHeader } from "@/components/shared/Section";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <PlatformPreview />
      <SampleReportPreview />

      <Section id="estimator" tone="muted">
        <Container size="md">
          <SectionHeader
            eyebrow="Free estimator"
            title="See your year-one savings in 30 seconds."
            description="Three inputs, a range-bound number, and a downloadable CSV of assumptions. No sign-up. No obligation."
          />
          <div className="mt-12">
            <Estimator />
          </div>
        </Container>
      </Section>

      <PricingSection compact />
      <Testimonials />
      <FaqSection limit={6} />
      <FinalCta />
    </>
  );
}
