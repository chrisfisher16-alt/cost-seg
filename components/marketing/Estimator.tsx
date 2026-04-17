"use client";

import { useState, useTransition } from "react";

import {
  attachLeadEmailAction,
  estimateAction,
  type EstimateActionResult,
} from "@/app/(marketing)/actions";
import { formatUsd, formatUsdRange, parseUsdInputToCents } from "@/lib/estimator/format";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/estimator/types";
import { cn } from "@/lib/utils";

import { AddressInput } from "./AddressInput";
import { ScopeDisclosure } from "./ScopeDisclosure";

type Stage =
  | { kind: "form" }
  | { kind: "loading" }
  | { kind: "result"; value: Extract<EstimateActionResult, { ok: true }> }
  | { kind: "error"; message: string };

export function Estimator() {
  const [stage, setStage] = useState<Stage>({ kind: "form" });
  const [isPending, startTransition] = useTransition();
  const [propertyType, setPropertyType] = useState<PropertyType>("SHORT_TERM_RENTAL");
  const [address, setAddress] = useState("");
  const [priceInput, setPriceInput] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseUsdInputToCents(priceInput);
    if (!cents) {
      setStage({ kind: "error", message: "Enter a purchase price." });
      return;
    }
    setStage({ kind: "loading" });
    startTransition(async () => {
      const response = await estimateAction({
        propertyType,
        purchasePriceCents: cents,
        address: address.trim() || undefined,
      });
      if (response.ok) {
        setStage({ kind: "result", value: response });
      } else {
        setStage({ kind: "error", message: response.error });
      }
    });
  }

  function resetForm() {
    setStage({ kind: "form" });
  }

  const busy = stage.kind === "loading" || isPending;

  return (
    <div className="mx-auto max-w-2xl">
      {stage.kind === "result" ? (
        <EstimatorResult
          data={stage.value}
          onReset={resetForm}
          inputs={{ propertyType, address, priceInput }}
        />
      ) : (
        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950"
        >
          <div className="space-y-1.5">
            <label htmlFor="address" className="text-sm font-medium">
              Property address
            </label>
            <AddressInput id="address" value={address} onChange={setAddress} />
            <p className="text-xs text-zinc-500">Optional — helps us contextualize.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="propertyType" className="text-sm font-medium">
                Property type
              </label>
              <select
                id="propertyType"
                name="propertyType"
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
                required
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PROPERTY_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="price" className="text-sm font-medium">
                Purchase price (USD)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-500">
                  $
                </span>
                <input
                  id="price"
                  name="price"
                  type="text"
                  inputMode="numeric"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="500,000"
                  className="w-full rounded-md border border-zinc-300 bg-white py-2 pr-3 pl-6 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
                  required
                />
              </div>
            </div>
          </div>

          {stage.kind === "error" ? (
            <p role="alert" className="text-sm text-red-600">
              {stage.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className={cn(
              "bg-foreground text-background inline-flex h-11 w-full items-center justify-center rounded-md text-sm font-medium transition",
              busy ? "opacity-60" : "hover:opacity-90",
            )}
          >
            {busy ? "Calculating…" : "Estimate my year-one savings"}
          </button>

          <ScopeDisclosure compact />
        </form>
      )}
    </div>
  );
}

function EstimatorResult({
  data,
  onReset,
  inputs,
}: {
  data: Extract<EstimateActionResult, { ok: true }>;
  onReset: () => void;
  inputs: { propertyType: PropertyType; address: string; priceInput: string };
}) {
  const { result, leadId } = data;
  return (
    <div className="space-y-6 rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-zinc-800/70 dark:bg-zinc-950">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-zinc-500 uppercase">
          Estimated year-one savings
        </p>
        <p className="text-4xl font-semibold tracking-tight">
          {formatUsdRange(result.savingsLowCents, result.savingsHighCents)}
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          at an assumed {(result.assumedBracket * 100).toFixed(0)}% marginal bracket
        </p>
      </header>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
          <dt className="text-xs tracking-wide text-zinc-500 uppercase">Reclassified basis</dt>
          <dd className="mt-1 font-medium">
            {formatUsdRange(result.reclassifiedLowCents, result.reclassifiedHighCents)}
          </dd>
          <p className="mt-1 text-xs text-zinc-500">
            {(result.lowPct * 100).toFixed(0)}–{(result.highPct * 100).toFixed(0)}% of purchase
            price for {PROPERTY_TYPE_LABELS[inputs.propertyType]}
          </p>
        </div>
        <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
          <dt className="text-xs tracking-wide text-zinc-500 uppercase">Purchase price</dt>
          <dd className="mt-1 font-medium">
            {formatUsd(parseUsdInputToCents(inputs.priceInput) ?? 0)}
          </dd>
          {inputs.address ? (
            <p className="mt-1 truncate text-xs text-zinc-500">{inputs.address}</p>
          ) : null}
        </div>
      </dl>

      <ScopeDisclosure />

      <LeadCaptureCard leadId={leadId} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href="#pricing"
          className="bg-foreground text-background inline-flex h-10 flex-1 items-center justify-center rounded-md text-sm font-medium transition hover:opacity-90"
        >
          Get a real study
        </a>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-zinc-300 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Recalculate
        </button>
      </div>
    </div>
  );
}

function LeadCaptureCard({ leadId }: { leadId: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setMessage("");
    const res = await attachLeadEmailAction(leadId, email);
    if (res.ok) {
      setState("success");
    } else {
      setState("error");
      setMessage(res.error);
    }
  }

  if (state === "success") {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        Got it. We&rsquo;ll email you a sample report within a day.
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 border-t border-zinc-200/70 pt-4 dark:border-zinc-800/70"
    >
      <label htmlFor="capture-email" className="text-sm font-medium">
        Email me a sample report
      </label>
      <div className="flex gap-2">
        <input
          id="capture-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400"
          autoComplete="email"
          required
        />
        <button
          type="submit"
          disabled={state === "pending"}
          className="bg-foreground text-background inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition hover:opacity-90 disabled:opacity-60"
        >
          {state === "pending" ? "Sending…" : "Send"}
        </button>
      </div>
      {state === "error" ? (
        <p role="alert" className="text-xs text-red-600">
          {message}
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">No spam. Unsubscribe anytime.</p>
    </form>
  );
}
