"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  DollarSignIcon,
  InfoIcon,
  SaveIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updatePropertyAction } from "@/app/(app)/studies/[id]/actions";
import { AddressInput, type StructuredAddress } from "@/components/marketing/AddressInput";
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
import { US_STATES } from "@/lib/estimator/us-states";
import { zipHint } from "@/lib/estimator/zip";
import { acquiredDateHint } from "@/lib/studies/acquired-date-hint";

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

  // Pin "now" to mount time via useState lazy init — React invokes the
  // initializer exactly once, so the hint computation stays stable across
  // keystrokes in the acquired-date input. Refreshing the page picks up
  // a new reference; fine, this is an intake form, not a long session.
  const [nowMs] = useState(() => Date.now());
  const dateHint = acquiredDateHint(acquiredAt, nowMs);

  // Inline ZIP hint drives aria-invalid + the Field error slot. We keep
  // the raw `zip` state as the source of truth (no parallel "touched"
  // state) — the hint itself classifies partial inputs as "partial" so
  // we never show an error mid-typing.
  const zipFeedback = zipHint(zip);

  /**
   * Auto-fill city/state/zip when the user picks a Google Places suggestion.
   * Only overwrites fields that have a new structured value — preserves
   * anything the user typed manually if Places returned a partial address.
   */
  function handlePlace(place: StructuredAddress) {
    if (place.streetAddress) setAddress(place.streetAddress);
    if (place.city) setCity(place.city);
    if (place.state) setStateCode(place.state);
    if (place.zip) setZip(place.zip);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    // Client-side gate — the server also validates, but blocking here
    // keeps the user on the page with the exact field focused instead of
    // showing a bottom-of-form "invalid input" after a round-trip.
    if (zipFeedback.kind !== "valid") {
      setError("Check the ZIP code before saving.");
      return;
    }
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
        <Field
          label="Address"
          required
          hint="Start typing and pick from the list — city, state, and ZIP auto-fill."
        >
          <AddressInput
            id="address"
            value={address}
            onChange={setAddress}
            onPlace={handlePlace}
            required
          />
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
          <Field label="State" required>
            <Select value={stateCode} onValueChange={setStateCode}>
              <SelectTrigger aria-label="State">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="ZIP" required error={zipFeedback.message ?? undefined}>
            <Input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              required
              pattern="\d{5}(-\d{4})?"
              autoComplete="postal-code"
              invalid={zipFeedback.kind === "invalid"}
              aria-invalid={zipFeedback.kind === "invalid" || undefined}
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
        <AcquiredDateHint hint={dateHint} />
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
            : "Save whenever you need to step away. Your report starts when you click Start my report."}
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

/**
 * Renders nothing on the happy path (current-year acquisitions). Shows a
 * primary-toned callout for prior-year placed-in-service dates (Form 3115
 * territory) and a destructive one for obvious typos (future dates).
 */
function AcquiredDateHint({ hint }: { hint: ReturnType<typeof acquiredDateHint> }) {
  if (hint.kind === "empty" || hint.kind === "current-year") return null;

  const destructive = hint.kind === "future";
  return (
    <div
      className={
        destructive
          ? "border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-lg border p-4 text-sm"
          : "border-primary/30 bg-primary/5 flex items-start gap-3 rounded-lg border p-4 text-sm"
      }
    >
      {destructive ? (
        <AlertTriangleIcon className="text-destructive mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <InfoIcon className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <div className="space-y-1">
        {hint.title ? (
          <p className="text-foreground leading-tight font-medium">{hint.title}</p>
        ) : null}
        {hint.message ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{hint.message}</p>
        ) : null}
      </div>
    </div>
  );
}
