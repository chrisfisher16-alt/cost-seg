import Link from "next/link";

import { GetStartedForm } from "@/components/marketing/GetStartedForm";
import { ScopeDisclosure } from "@/components/marketing/ScopeDisclosure";
import { getOptionalAuth } from "@/lib/auth/require";
import { CATALOG, formatCents, type Tier } from "@/lib/stripe/catalog";
import { isStripeConfigured } from "@/lib/stripe/client";

type Props = {
  searchParams: Promise<{ tier?: string; cancelled?: string }>;
};

function isTier(value: string | undefined): value is Tier {
  return value === "AI_REPORT" || value === "ENGINEER_REVIEWED";
}

export const metadata = { title: "Get started" };

export default async function GetStartedPage({ searchParams }: Props) {
  const params = await searchParams;
  const tier = isTier(params.tier) ? params.tier : "AI_REPORT";
  const entry = CATALOG[tier];
  const ctx = await getOptionalAuth();

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col px-6 py-16">
      <header className="mb-8">
        <Link href="/#pricing" className="hover:text-foreground text-xs text-zinc-500">
          &larr; Back to pricing
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Start a {entry.label}</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {formatCents(entry.priceCents)} · {entry.blurb}
        </p>
      </header>

      {params.cancelled === "1" ? (
        <p
          role="alert"
          className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Checkout was cancelled. No charge was made — your form is preserved if you&rsquo;d like to
          try again.
        </p>
      ) : null}

      <GetStartedForm
        tier={tier}
        defaultEmail={ctx?.user.email}
        stripeConfigured={isStripeConfigured()}
      />

      <div className="mt-10">
        <ScopeDisclosure />
      </div>
    </main>
  );
}
