"use client";

import { MapPinIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Subset of the google.maps.places.PlaceResult shape we rely on. The types
 * package isn't installed, so we declare what we read and cast the rest.
 */
interface PlaceResult {
  formatted_address?: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

interface AutocompleteInstance {
  addListener(event: "place_changed", cb: () => void): { remove(): void };
  getPlace(): PlaceResult;
}

interface GoogleNamespace {
  maps: {
    places: {
      Autocomplete: new (
        input: HTMLInputElement,
        options: {
          fields: string[];
          types: string[];
          componentRestrictions?: { country: string[] };
        },
      ) => AutocompleteInstance;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
    __cs_places_loader?: Promise<void>;
  }
}

const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

/**
 * Structured address parts extracted from a Google Places autocomplete
 * selection. All fields are best-effort — some addresses lack pieces
 * (e.g. PO boxes have no street). Callers decide whether to fall back to
 * the raw formatted string.
 */
export interface StructuredAddress {
  /** The full formatted_address as Google returned it. */
  formatted: string;
  /** Street number + route, e.g. "123 Main St". */
  streetAddress: string;
  city: string;
  /** 2-letter state code (short_name), e.g. "CA". */
  state: string;
  zip: string;
}

function parseAddressComponents(place: PlaceResult): StructuredAddress {
  const components = place.address_components ?? [];
  const find = (type: string, short = false) => {
    const match = components.find((c) => c.types.includes(type));
    return match ? (short ? match.short_name : match.long_name) : "";
  };

  const streetNumber = find("street_number");
  const route = find("route");
  const streetAddress = [streetNumber, route].filter(Boolean).join(" ");
  // Fall back down the Google locality hierarchy for less-common territories.
  const city =
    find("locality") ||
    find("postal_town") ||
    find("sublocality_level_1") ||
    find("administrative_area_level_2");
  const state = find("administrative_area_level_1", true);
  const zip = find("postal_code");

  return {
    formatted: place.formatted_address ?? "",
    streetAddress,
    city,
    state,
    zip,
  };
}

function loadPlaces(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (!PLACES_KEY) return Promise.reject(new Error("no-key"));
  if (window.google?.maps?.places) return Promise.resolve();
  if (window.__cs_places_loader) return window.__cs_places_loader;
  window.__cs_places_loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(PLACES_KEY)}&libraries=places&v=quarterly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("places-load-failed"));
    document.head.appendChild(script);
  });
  return window.__cs_places_loader;
}

interface AddressInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /**
   * Fired when the user picks an autocomplete suggestion. Receives the raw
   * formatted string (same as onChange) plus the parsed street/city/state/zip.
   * Callers use this to auto-fill structured fields they'd otherwise make
   * the user type manually.
   */
  onPlace?: (address: StructuredAddress) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export function AddressInput({
  id,
  value,
  onChange,
  onPlace,
  className,
  placeholder,
  required,
}: AddressInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    if (!PLACES_KEY || !ref.current) return;
    let cancelled = false;
    let sub: { remove(): void } | undefined;
    loadPlaces()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        const ac = new window.google.maps.places.Autocomplete(ref.current, {
          fields: ["formatted_address", "address_components"],
          types: ["address"],
          componentRestrictions: { country: ["us"] },
        });
        sub = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const structured = parseAddressComponents(place);
          if (structured.formatted) {
            onChange(structured.formatted);
            onPlace?.(structured);
          }
        });
        setEnhanced(true);
      })
      .catch(() => {
        /* graceful fallback — plain text input still works. */
      });
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [onChange, onPlace]);

  return (
    <Input
      ref={ref}
      id={id}
      name="address"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        placeholder ?? (enhanced ? "Start typing an address…" : "123 Main St, Asheville, NC")
      }
      autoComplete="street-address"
      required={required}
      leadingAdornment={<MapPinIcon className="h-4 w-4" aria-hidden />}
      className={cn(className)}
    />
  );
}
