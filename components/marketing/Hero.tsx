export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-200/60 bg-gradient-to-b from-white to-zinc-50 py-20 dark:border-zinc-800/60 dark:from-zinc-950 dark:to-black">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="mb-4 font-mono text-xs tracking-widest text-zinc-500 uppercase">
          Under the One Big Beautiful Bill Act &middot; 100% bonus depreciation restored
        </p>
        <h1 className="text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Cost segregation studies, without the six-week wait.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-balance text-zinc-600 dark:text-zinc-400">
          Turn your real-estate basis into year-one tax deductions. Get an AI modeling report in
          minutes, or an engineer-signed, audit-defensible study in days.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#estimator"
            className="bg-foreground text-background inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition hover:opacity-90"
          >
            Estimate your savings
          </a>
          <a
            href="#pricing"
            className="text-foreground inline-flex h-11 items-center justify-center rounded-full border border-zinc-200 px-6 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            See pricing
          </a>
        </div>
      </div>
    </section>
  );
}
