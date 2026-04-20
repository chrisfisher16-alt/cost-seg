"use client";

import { ArrowRightIcon, DollarSignIcon, LockIcon, MailIcon, TicketIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { startCheckoutAction } from "@/app/get-started/actions";
import { AddressInput, type StructuredAddress } from "@/components/marketing/AddressInput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/estimator/types";
import type { Tier } from "@/lib/stripe/catalog";

interface Props {
  tier: Tier;
  defaultEmail?: string;
  stripeConfigured: boolean;
  /** When true, the page offers a collapsible promo-code input that skips Stripe. */
  promoBypassEnabled?: boolean;
}

export function GetStartedForm({
  tier,
  defaultEmail,
  stripeConfigured,
  promoBypassEnabled = false,
}: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [propertyType, setPropertyType] = useState<PropertyType>("SHORT_TERM_RENTAL");
  const [addressLine, setAddressLine] = useState("");
  /**
   * Structured address captured when the user picks an autocomplete
   * suggestion. Cleared when they retype so we don't send stale parts
   * alongside a hand-edited address line.
   */
  const [structured, setStructured] = useState<StructuredAddress | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const usingPromo = promoOpen && promoCode.trim().length > 0;

  function handleAddressChange(value: string) {
    setAddressLine(value);
    // If the user edits after picking, the structured parts no longer
    // describe what's in the input — drop them to avoid mismatch.
    if (structured && value !== structured.formatted) setStructured(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await startCheckoutAction({
        tier,
        propertyType,
        email,
        addressLine: addressLine.trim() || undefined,
        streetAddress: structured?.streetAddress || undefined,
        city: structured?.city || undefined,
        state: structured?.state || undefined,
        zip: structured?.zip || undefined,
        purchasePriceRaw: purchasePrice.trim() || undefined,
        promoCode: usingPromo ? promoCode.trim() : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.href = result.url;
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {!stripeConfigured ? (
        <Alert variant="warning">
          <AlertTitle>Payment is not configured in this environment</AlertTitle>
          <AlertDescription>
            Your dev setup is missing the Stripe keys in{" "}
            <span className="font-mono">.env.local</span>. Add them and restart the dev server to
            enable checkout
            {promoBypassEnabled
              ? " — or use the promo code below to skip straight to intake."
              : "."}
          </AlertDescription>
        </Alert>
      ) : null}

      <Field
        label="Email"
        required
        htmlFor="email"
        hint="We&rsquo;ll email you a sign-in link after payment so you can upload documents."
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          leadingAdornment={<MailIcon className="h-4 w-4" />}
        />
      </Field>

      <Field label="Property type" required>
        <Select value={propertyType} onValueChange={(v) => setPropertyType(v as PropertyType)}>
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

      <Field
        label="Property address"
        hint="Optional — you&rsquo;ll refine this during intake."
        htmlFor="addressLine"
      >
        <AddressInput
          id="addressLine"
          value={addressLine}
          onChange={handleAddressChange}
          onPlace={setStructured}
          placeholder="Start typing an address…"
        />
      </Field>

      <Field
        label="Purchase price"
        hint="Optional — we&rsquo;ll extract this from your closing disclosure."
        htmlFor="purchasePrice"
      >
        <Input
          id="purchasePrice"
          type="text"
          inputMode="numeric"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          placeholder="500,000"
          leadingAdornment={<DollarSignIcon className="h-4 w-4" />}
        />
      </Field>

      {promoBypassEnabled ? (
        <div className="border-border/60 border-t pt-4">
          {!promoOpen ? (
            <button
              type="button"
              onClick={() => setPromoOpen(true)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium underline-offset-4 hover:underline"
            >
              <TicketIcon className="h-3.5 w-3.5" aria-hidden />I have a promo code
            </button>
          ) : (
            <Field
              label="Promo code"
              htmlFor="promoCode"
              hint="Skips Stripe and lands you at intake. Only works when the code matches the server-side value."
            >
              <Input
                id="promoCode"
                type="text"
                autoComplete="off"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Enter your code"
                leadingAdornment={<TicketIcon className="h-4 w-4" />}
              />
            </Field>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!stripeConfigured && !usingPromo}
        loading={isPending}
        loadingText={usingPromo ? "Applying promo…" : "Opening secure checkout…"}
        trailingIcon={<ArrowRightIcon />}
      >
        {usingPromo ? "Skip checkout with promo" : "Continue to secure checkout"}
      </Button>
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
        <LockIcon className="h-3 w-3" aria-hidden />
        {usingPromo
          ? "Promo bypass — no charge. You'll get a sign-in link by email."
          : "Powered by Stripe. We never see your card."}
      </p>
    </form>
  );
}
