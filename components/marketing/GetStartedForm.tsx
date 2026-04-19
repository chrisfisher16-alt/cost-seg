"use client";

import { ArrowRightIcon, DollarSignIcon, LockIcon, MailIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { startCheckoutAction } from "@/app/get-started/actions";
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
    <form onSubmit={submit} className="space-y-6">
      {!stripeConfigured ? (
        <Alert variant="warning">
          <AlertTitle>Payment is not configured in this environment</AlertTitle>
          <AlertDescription>
            Your dev setup is missing the Stripe keys in{" "}
            <span className="font-mono">.env.local</span>. Add them and restart the dev server to
            enable checkout.
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
        <Input
          id="addressLine"
          type="text"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
          placeholder="123 Main St, Asheville, NC"
          autoComplete="street-address"
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

      {error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!stripeConfigured}
        loading={isPending}
        loadingText="Opening secure checkout…"
        trailingIcon={<ArrowRightIcon />}
      >
        Continue to secure checkout
      </Button>
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-xs">
        <LockIcon className="h-3 w-3" aria-hidden />
        Powered by Stripe. We never see your card.
      </p>
    </form>
  );
}
