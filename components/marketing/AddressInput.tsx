"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface PlaceResult {
  formatted_address?: string;
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
  className?: string;
}

export function AddressInput({ id, value, onChange, className }: AddressInputProps) {
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
          fields: ["formatted_address"],
          types: ["address"],
          componentRestrictions: { country: ["us"] },
        });
        sub = ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (place.formatted_address) onChange(place.formatted_address);
        });
        setEnhanced(true);
      })
      .catch(() => {
        // Graceful fallback — plain text input still works.
      });
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [onChange]);

  return (
    <input
      ref={ref}
      id={id}
      name="address"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={enhanced ? "Start typing an address…" : "123 Main St, Asheville, NC"}
      autoComplete="street-address"
      className={cn(
        "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm transition outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-400",
        className,
      )}
    />
  );
}
