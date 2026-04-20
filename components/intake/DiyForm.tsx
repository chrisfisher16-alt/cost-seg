"use client";

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  DollarSignIcon,
  InfoIcon,
  LandmarkIcon,
  SparklesIcon,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { submitDiyStudyAction } from "@/app/(app)/studies/[id]/diy/actions";
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
import { parseUsdInputToCents } from "@/lib/estimator/format";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyType } from "@/lib/estimator/types";
import { US_STATES } from "@/lib/estimator/us-states";
import { acquiredDateHint } from "@/lib/studies/acquired-date-hint";
import { DEFAULT_LAND_PCT } from "@/lib/studies/diy-pipeline";

interface InitialValues {
  address: string;
  city: string;
  state: string;
  zip: string;
  purchasePriceDollars: string;
  acquiredAt: string;
  propertyType: PropertyType;
  squareFeet?: number | null;
  yearBuilt?: number | null;
}

export function DiyForm({ studyId, initial }: { studyId: string; initial: InitialValues }) {
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [stateCode, setStateCode] = useState(initial.state);
  const [zip, setZip] = useState(initial.zip);
  const [price, setPrice] = useState(initial.purchasePriceDollars);
  const [landValue, setLandValue] = useState("");
  const [acquiredAt, setAcquiredAt] = useState(initial.acquiredAt);
  const [propertyType, setPropertyType] = useState<PropertyType>(initial.propertyType);
  const [squareFeet, setSquareFeet] = useState<string>(initial.squareFeet?.toString() ?? "");
  const [yearBuilt, setYearBuilt] = useState<string>(initial.yearBuilt?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const priceCents = useMemo(() => parseUsdInputToCents(price) ?? 0, [price]);
  const landCents = useMemo(() => parseUsdInputToCents(landValue) ?? 0, [landValue]);
  const buildingCents = Math.max(0, priceCents - landCents);
  const suggestedLandCents = Math.round(priceCents * DEFAULT_LAND_PCT[propertyType]);
  const showLandSuggestion = priceCents > 0 && landCents === 0 && suggestedLandCents > 0;
  // Lazy useState init pins "now" to mount without tripping the
  // react-hooks/purity rule.
  const [nowMs] = useState(() => Date.now());
  const dateHint = acquiredDateHint(acquiredAt, nowMs);

  function useSuggestion() {
    setLandValue(formatDollars(suggestedLandCents));
  }

  /**
   * Auto-fill city/state/zip when Places autocomplete fires — matches the
   * PropertyForm behavior so the DIY flow gets the same "one address, all
   * parts" convenience.
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
    startTransition(async () => {
      const result = await submitDiyStudyAction(studyId, {
        address,
        city,
        state: stateCode,
        zip,
        purchasePriceRaw: price,
        landValueRaw: landValue,
        acquiredAt,
        propertyType,
        squareFeet: squareFeet ? Number(squareFeet) : undefined,
        yearBuilt: yearBuilt ? Number(yearBuilt) : undefined,
      });
      if (!result) return; // action redirected — we won't hit this branch
      if (!result.ok) {
        setError(result.error);
        toast.error("Couldn't generate your report", { description: result.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Property</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Tell us which property this is for.
          </p>
        </div>

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

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" required>
            <Input
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
          <Field label="ZIP" required>
            <Input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              required
              pattern="\d{5}(-\d{4})?"
              autoComplete="postal-code"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Field label="Acquired date" required>
            <Input
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              required
            />
          </Field>
        </div>

        <DiyAcquiredDateHint hint={dateHint} />

        <div className="grid gap-4 sm:grid-cols-2">
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
      </section>

      <div className="bg-border h-px w-full" />

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Basis and land value</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Two numbers. Everything else flows from them.
          </p>
        </div>

        <Field
          label="Total purchase price"
          required
          hint="What you paid, including capitalized closing costs. Pulled from your closing disclosure."
        >
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

        <Field
          label="Land value"
          required
          hint="From your county assessor record (the separately-stated land portion). If you're not sure, use the suggestion below."
        >
          <Input
            type="text"
            inputMode="numeric"
            value={landValue}
            onChange={(e) => setLandValue(e.target.value)}
            required
            placeholder={showLandSuggestion ? formatDollars(suggestedLandCents) : "100,000"}
            leadingAdornment={<LandmarkIcon className="h-4 w-4" />}
          />
        </Field>

        {showLandSuggestion ? (
          <Alert variant="info">
            <SparklesIcon />
            <AlertTitle>Suggested land value: {formatDollars(suggestedLandCents)}</AlertTitle>
            <AlertDescription className="mt-2">
              Typical land allocation for {PROPERTY_TYPE_LABELS[propertyType].toLowerCase()} is
              about {(DEFAULT_LAND_PCT[propertyType] * 100).toFixed(0)}% of purchase price. Use as a
              starting point — your assessor record is the authoritative source.
            </AlertDescription>
            <div className="mt-3">
              <Button type="button" size="sm" variant="outline" onClick={useSuggestion}>
                Use suggested value
              </Button>
            </div>
          </Alert>
        ) : null}

        {priceCents > 0 && landCents > 0 && landCents < priceCents ? (
          <div className="border-primary/30 bg-primary/5 rounded-md border p-4 text-sm">
            <p className="text-primary font-medium">
              Depreciable basis: {formatDollars(buildingCents)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              That&rsquo;s what we&rsquo;ll allocate across MACRS classes on your report.
            </p>
          </div>
        ) : null}
      </section>

      {error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}

      <div className="border-border flex flex-col-reverse items-stretch gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          Your report generates instantly. PDF downloads from the next screen and arrives by email.
        </p>
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingText="Generating your report…"
          trailingIcon={<ArrowRightIcon />}
        >
          Generate my DIY report
        </Button>
      </div>
    </form>
  );
}

function formatDollars(cents: number): string {
  if (cents <= 0) return "";
  return new Intl.NumberFormat("en-US").format(Math.round(cents / 100));
}

/**
 * Same presentation as PropertyForm's AcquiredDateHint — kept local so
 * each form file is self-contained and we don't pull a 3rd file in for a
 * 20-line component.
 */
function DiyAcquiredDateHint({ hint }: { hint: ReturnType<typeof acquiredDateHint> }) {
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
