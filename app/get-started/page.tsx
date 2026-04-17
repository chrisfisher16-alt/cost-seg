import Link from "next/link";

import { CATALOG, formatCents, type Tier } from "@/lib/stripe/catalog";

type Props = {
  searchParams: Promise<{ tier?: string }>;
};

function isTier(value: string | undefined): value is Tier {
  return value === "AI_REPORT" || value === "ENGINEER_REVIEWED";
}

export default async function GetStartedPage({ searchParams }: Props) {
  const params = await searchParams;
  const tier = isTier(params.tier) ? params.tier : "AI_REPORT";
  const entry = CATALOG[tier];
  return (
    <main className="mx-auto flex max-w-xl flex-1 flex-col justify-center px-6 py-24 text-center">
      <p className="font-mono text-xs tracking-widest text-zinc-500 uppercase">
        Phase 3 placeholder
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {entry.label} — {formatCents(entry.priceCents)}
      </h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400">
        Stripe Checkout will wire up here in Phase 3. For now, leave your email on the estimator and
        we&rsquo;ll reach out when we open the gate.
      </p>
      <Link
        href="/#estimator"
        className="mx-auto mt-8 inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 px-6 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Back to the estimator
      </Link>
    </main>
  );
}
