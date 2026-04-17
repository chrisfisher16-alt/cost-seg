"use client";

import { useState, useTransition } from "react";

import { startCheckoutAction } from "@/app/get-started/actions";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/estimator/types";
import type { Tier } from "@/lib/stripe/catalog";
import { cn } from "@/lib/utils";

interface Props {
  tier: Tier;
  defaultEmail?: string;
  stripeConfigured: boolean;
}

export function GetStartedForm({ tier, defaultEmail, stripeConfigured }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [propertyType, setPropertyType] = useState<PropertyType>("SHORT_TERM_RENTAL");
  const [addressLine, setAddressLine] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startCheckoutAction({
        tier,
        propertyType,
        email,
        addressLine: addressLine.trim() || undefined,
        purchasePriceRaw: purchasePrice.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {!stripeConfigured ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          Stripe is not configured in this environment. Form is disabled.
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
        <p className="text-xs text-zinc-500">
          We&rsquo;ll email you a sign-in link to upload documents after payment.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="propertyType" className="text-sm font-medium">
          Property type
        </label>
        <select
          id="propertyType"
          value={propertyType}
          onChange={(e) => setPropertyType(e.target.value as PropertyType)}
          required
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {PROPERTY_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="addressLine" className="text-sm font-medium">
          Property address <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          id="addressLine"
          type="text"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder="123 Main St, Asheville, NC"
          autoComplete="street-address"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="purchasePrice" className="text-sm font-medium">
          Purchase price <span className="text-zinc-400">(optional)</span>
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-500">
            $
          </span>
          <input
            id="purchasePrice"
            type="text"
            inputMode="numeric"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            placeholder="500,000"
            className="w-full rounded-md border border-zinc-300 bg-white py-2 pr-3 pl-6 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
          />
        </div>
        <p className="text-xs text-zinc-500">
          Fill this in later during intake if you&rsquo;d rather.
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !stripeConfigured}
        className={cn(
          "bg-foreground text-background inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition",
          isPending || !stripeConfigured ? "opacity-60" : "hover:opacity-90",
        )}
      >
        {isPending ? "Opening Stripe…" : "Continue to secure checkout"}
      </button>
      <p className="text-center text-xs text-zinc-500">
        Powered by Stripe. We never see your card.
      </p>
    </form>
  );
}
