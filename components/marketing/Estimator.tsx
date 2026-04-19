"use client";

import { ArrowRightIcon, CheckCircle2Icon, DollarSignIcon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  attachLeadEmailAction,
  estimateAction,
  type EstimateActionResult,
} from "@/app/(marketing)/actions";
import { Kpi } from "@/components/shared/Kpi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUsd, formatUsdRange, parseUsdInputToCents } from "@/lib/estimator/format";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/estimator/types";

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
      setStage({ kind: "error", message: "Enter a purchase price to continue." });
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
        <Card>
          <CardContent className="p-7">
            <form onSubmit={submit} className="space-y-5">
              <Field
                label="Property address"
                htmlFor="address"
                hint="Optional — helps us contextualize."
              >
                <AddressInput id="address" value={address} onChange={setAddress} />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Property type" required>
                  <Select
                    value={propertyType}
                    onValueChange={(v) => setPropertyType(v as PropertyType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {PROPERTY_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Purchase price" required htmlFor="price">
                  <Input
                    id="price"
                    name="price"
                    type="text"
                    inputMode="numeric"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder="500,000"
                    leadingAdornment={<DollarSignIcon className="h-4 w-4" />}
                    required
                  />
                </Field>
              </div>

              {stage.kind === "error" ? (
                <p role="alert" className="text-destructive text-sm font-medium">
                  {stage.message}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={busy}
                loadingText="Calculating your year-one savings…"
                trailingIcon={<ArrowRightIcon />}
              >
                Estimate my year-one savings
              </Button>

              <ScopeDisclosure compact />
            </form>
          </CardContent>
        </Card>
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
    <Card className="border-primary/20 bg-card ring-primary/10 overflow-hidden shadow-lg ring-1">
      <CardContent className="p-7 sm:p-8">
        <Kpi
          label="Estimated year-one savings"
          value={formatUsdRange(result.savingsLowCents, result.savingsHighCents)}
          hint={`at an assumed ${(result.assumedBracket * 100).toFixed(0)}% marginal bracket`}
          size="xl"
          tone="accent"
          animate
        />

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="bg-muted/40 rounded-lg p-4">
            <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
              Reclassified basis
            </dt>
            <dd data-tabular className="mt-1.5 text-lg font-semibold">
              {formatUsdRange(result.reclassifiedLowCents, result.reclassifiedHighCents)}
            </dd>
            <p className="text-muted-foreground mt-1 text-xs">
              {(result.lowPct * 100).toFixed(0)}–{(result.highPct * 100).toFixed(0)}% of purchase
              price for {PROPERTY_TYPE_LABELS[inputs.propertyType]}
            </p>
          </div>
          <div className="bg-muted/40 rounded-lg p-4">
            <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
              Purchase price
            </dt>
            <dd data-tabular className="mt-1.5 text-lg font-semibold">
              {formatUsd(parseUsdInputToCents(inputs.priceInput) ?? 0)}
            </dd>
            {inputs.address ? (
              <p className="text-muted-foreground mt-1 truncate text-xs">{inputs.address}</p>
            ) : null}
          </div>
        </dl>

        <div className="mt-6">
          <ScopeDisclosure />
        </div>

        <LeadCaptureCard leadId={leadId} />

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" className="flex-1" trailingIcon={<ArrowRightIcon />}>
            <Link href="/pricing">Start a real study</Link>
          </Button>
          <Button
            type="button"
            onClick={onReset}
            variant="outline"
            size="lg"
            className="flex-1"
            leadingIcon={<RotateCwIcon />}
          >
            Recalculate
          </Button>
        </div>
      </CardContent>
    </Card>
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
      <div className="border-success/30 bg-success/5 text-success mt-6 flex items-center gap-3 rounded-md border p-3 text-sm">
        <CheckCircle2Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span>Got it — we&rsquo;ll email you a sample report within one business day.</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-border mt-6 space-y-2 border-t pt-6">
      <Field
        label="Email me a sample report"
        hint="No spam. Unsubscribe anytime."
        htmlFor="capture-email"
      >
        <div className="flex gap-2">
          <Input
            id="capture-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Button type="submit" loading={state === "pending"} loadingText="Sending…">
            Send
          </Button>
        </div>
      </Field>
      {state === "error" ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {message}
        </p>
      ) : null}
    </form>
  );
}
