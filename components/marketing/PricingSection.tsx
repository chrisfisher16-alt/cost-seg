import Link from "next/link";

import { CATALOG, formatCents, type Tier } from "@/lib/stripe/catalog";
import { cn } from "@/lib/utils";

type TierCardProps = {
  tier: Tier;
  featured?: boolean;
  turnaround: string;
  bullets: string[];
  footnote: string;
};

const CARDS: TierCardProps[] = [
  {
    tier: "AI_REPORT",
    turnaround: "Delivered in minutes",
    bullets: [
      "Software-generated asset schedule",
      "Year-one depreciation projection",
      "Branded PDF report",
      "Scope disclosure on every page",
    ],
    footnote: "A planning tool, not an IRS-defensible study. Have your CPA review before filing.",
  },
  {
    tier: "ENGINEER_REVIEWED",
    featured: true,
    turnaround: "Delivered in 3–7 days",
    bullets: [
      "Everything in AI Report",
      "Licensed PE review & signature",
      "13-element ATG compliance checklist",
      "Audit-defensible under IRS Pub 5653",
    ],
    footnote: "Signed by a US-licensed Professional Engineer contracted by us.",
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-zinc-200/60 py-20 dark:border-zinc-800/60">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Pick the report you need
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
            Start with the AI Report for planning. Upgrade to an Engineer-Reviewed study when
            you&rsquo;re filing — without re-uploading anything.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {CARDS.map((card) => (
            <TierCard key={card.tier} {...card} />
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-zinc-500">
          Prices are for a single property. Bulk, CPA, and portfolio pricing available post-launch.
        </p>
      </div>
    </section>
  );
}

function TierCard({ tier, featured, turnaround, bullets, footnote }: TierCardProps) {
  const entry = CATALOG[tier];
  return (
    <article
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 shadow-sm",
        featured
          ? "border-foreground ring-foreground/10 bg-white ring-2 dark:bg-zinc-950"
          : "border-zinc-200/70 bg-white dark:border-zinc-800/70 dark:bg-zinc-950",
      )}
    >
      {featured ? (
        <span className="bg-foreground text-background absolute top-4 right-4 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-widest uppercase">
          Audit-ready
        </span>
      ) : null}
      <header>
        <h3 className="text-xl font-semibold tracking-tight">{entry.label}</h3>
        <p className="mt-1 text-sm text-zinc-500">{turnaround}</p>
      </header>
      <p className="mt-6 text-4xl font-semibold tracking-tight">{formatCents(entry.priceCents)}</p>
      <ul className="mt-6 space-y-2 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <CheckIcon />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Link
          href={{ pathname: "/get-started", query: { tier } }}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition",
            featured
              ? "bg-foreground text-background hover:opacity-90"
              : "border border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900",
          )}
        >
          {featured ? "Start an engineered study" : "Start an AI Report"}
        </Link>
        <p className="mt-3 text-xs text-zinc-500">{footnote}</p>
      </div>
    </article>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="mt-0.5 h-4 w-4 flex-none text-emerald-600"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      />
    </svg>
  );
}
