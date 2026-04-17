import { Estimator } from "@/components/marketing/Estimator";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { PricingSection } from "@/components/marketing/PricingSection";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <section
        id="estimator"
        className="border-t border-zinc-200/60 bg-zinc-50/40 py-20 dark:border-zinc-800/60 dark:bg-zinc-950/40"
      >
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Run a free estimate
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-600 dark:text-zinc-400">
              Three inputs, a range-bound number, and a download link when you&rsquo;re ready. No
              signup for the estimate.
            </p>
          </div>
          <Estimator />
        </div>
      </section>
      <PricingSection />
    </>
  );
}
