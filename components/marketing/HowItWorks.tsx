const STEPS = [
  {
    title: "Tell us about the property",
    body: "Address, purchase price, and property type. No account needed for the estimate.",
  },
  {
    title: "Upload three documents",
    body: "Closing disclosure, improvement receipts, and a few property photos. 25MB per file.",
  },
  {
    title: "Get your report",
    body: "AI Report in minutes. Engineer-Reviewed study signed and delivered in 3–7 days.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-600 dark:text-zinc-400">
          Built for owners of short-term rentals, small multifamily, and commercial real estate who
          want year-one depreciation without paying $5,000 for a 6-week engagement.
        </p>
        <ol className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950"
            >
              <div className="mb-3 font-mono text-xs text-zinc-500">Step {i + 1}</div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
