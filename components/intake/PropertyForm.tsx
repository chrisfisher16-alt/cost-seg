"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updatePropertyAction } from "@/app/(app)/studies/[id]/actions";
import { AddressInput } from "@/components/marketing/AddressInput";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/estimator/types";
import { cn } from "@/lib/utils";

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
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "idle" });
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
        setStatus({ kind: "saved" });
        router.refresh();
      } else {
        setStatus({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={locked} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="address" className="text-sm font-medium">
            Address
          </label>
          <AddressInput id="address" value={address} onChange={setAddress} />
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="City">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className={fieldClass}
              autoComplete="address-level2"
            />
          </Field>
          <Field label="State (2-letter)">
            <input
              type="text"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value.toUpperCase())}
              required
              maxLength={2}
              className={fieldClass}
              autoComplete="address-level1"
            />
          </Field>
          <Field label="ZIP">
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              required
              pattern="\d{5}(-\d{4})?"
              className={fieldClass}
              autoComplete="postal-code"
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Property type">
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              required
              className={fieldClass}
            >
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROPERTY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purchase price (USD)">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-zinc-500">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
                placeholder="500,000"
                className={cn(fieldClass, "pl-6")}
              />
            </div>
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Acquired date">
            <input
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              required
              className={fieldClass}
            />
          </Field>
          <Field label="Square feet (optional)">
            <input
              type="number"
              min={1}
              value={squareFeet}
              onChange={(e) => setSquareFeet(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Year built (optional)">
            <input
              type="number"
              min={1800}
              max={2100}
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>
      </fieldset>

      {status.kind === "error" ? (
        <p role="alert" className="text-sm text-red-600">
          {status.message}
        </p>
      ) : null}
      {status.kind === "saved" ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">Saved.</p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {locked ? (
          <p className="text-xs text-zinc-500">
            Property details are locked — processing has started.
          </p>
        ) : (
          <button
            type="submit"
            disabled={isPending || locked}
            className={cn(
              "bg-foreground text-background inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition",
              isPending ? "opacity-60" : "hover:opacity-90",
            )}
          >
            {isPending ? "Saving…" : "Save property details"}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

const fieldClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400";
