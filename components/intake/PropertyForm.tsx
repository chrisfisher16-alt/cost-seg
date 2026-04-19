"use client";

import { CheckCircle2Icon, DollarSignIcon, SaveIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePropertyAction } from "@/app/(app)/studies/[id]/actions";
import { AddressInput } from "@/components/marketing/AddressInput";
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

interface InitialValues {
  address: string;
  city: string;
  state: string;
  zip: string;
  purchasePriceDollars: string;
  acquiredAt: string; // YYYY-MM-DD
  propertyType: PropertyType;
  squareFeet?: number | null;
  yearBuilt?: number | null;
}

export function PropertyForm({
  studyId,
  initial,
  locked,
}: {
  studyId: string;
  initial: InitialValues;
  locked: boolean;
}) {
  const router = useRouter();
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [stateCode, setStateCode] = useState(initial.state);
  const [zip, setZip] = useState(initial.zip);
  const [price, setPrice] = useState(initial.purchasePriceDollars);
  const [acquiredAt, setAcquiredAt] = useState(initial.acquiredAt);
  const [propertyType, setPropertyType] = useState<PropertyType>(initial.propertyType);
  const [squareFeet, setSquareFeet] = useState<string>(initial.squareFeet?.toString() ?? "");
  const [yearBuilt, setYearBuilt] = useState<string>(initial.yearBuilt?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePropertyAction(studyId, {
        address,
        city,
        state: stateCode,
        zip,
        purchasePriceRaw: price,
        acquiredAt,
        propertyType,
        squareFeet: squareFeet ? Number(squareFeet) : undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
      });
      if (result.ok) {
        toast.success("Property details saved.", {
          icon: <CheckCircle2Icon className="h-4 w-4" />,
        });
        router.refresh();
      } else {
        setError(result.error);
        toast.error("Couldn't save", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={locked} className="space-y-5">
        <Field label="Address" required>
          <AddressInput id="address" value={address} onChange={setAddress} required />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="City" required>
            <Input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              autoComplete="address-level2"
            />
          </Field>
          <Field label="State" required hint="2-letter code">
            <Input
              type="text"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.toUpperCase())}
              required
              maxLength={2}
              autoComplete="address-level1"
            />
          </Field>
          <Field label="ZIP" required>
            <Input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              required
              pattern="\d{5}(-\d{4})?"
              autoComplete="postal-code"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
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
          <Field label="Purchase price" required>
            <Input
              type="text"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              placeholder="500,000"
              leadingAdornment={<DollarSignIcon className="h-4 w-4" />}
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Acquired date" required>
            <Input
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              required
            />
          </Field>
          <Field label="Square feet" hint="Optional">
            <Input
              type="number"
              min={1}
              value={squareFeet}
              onChange={(e) => setSquareFeet(e.target.value)}
            />
          </Field>
          <Field label="Year built" hint="Optional">
            <Input
              type="number"
              min={1800}
              max={2100}
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {locked
            ? "Property details are locked — processing has started."
            : "Save whenever you need to step away. Nothing is submitted yet."}
        </p>
        {!locked ? (
          <Button
            type="submit"
            size="default"
            loading={isPending}
            loadingText="Saving…"
            leadingIcon={<SaveIcon />}
          >
            Save property details
          </Button>
        ) : null}
      </div>
    </form>
  );
}
