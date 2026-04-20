import { render } from "@testing-library/react";
import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AddressInput as AddressInputType } from "@/components/marketing/AddressInput";

/**
 * Regression test for B3-3: the Google Places Autocomplete widget must be
 * created exactly once per AddressInput mount, not once per parent re-render.
 *
 * Before the ref-based fix, the useEffect dep array was `[onChange, onPlace]`.
 * Parents that didn't `useCallback` those props handed over a new identity
 * on every state change, which re-ran the effect, tore down the listener,
 * and instantiated a fresh `new google.maps.places.Autocomplete(...)` on the
 * same input — leaking pac-container divs and sometimes firing duplicate
 * `place_changed` handlers.
 */

type PlaceChangedCb = () => void;

interface AutocompleteOptions {
  fields: string[];
  types: string[];
  componentRestrictions?: { country: string[] };
}

const ctorSpy = vi.fn();
const placeChangedCbs: PlaceChangedCb[] = [];

class MockAutocomplete {
  constructor(_input: HTMLInputElement, options: AutocompleteOptions) {
    ctorSpy(options);
  }
  addListener(event: string, cb: PlaceChangedCb) {
    if (event === "place_changed") placeChangedCbs.push(cb);
    return {
      remove() {
        /* noop for test */
      },
    };
  }
  getPlace() {
    return {
      formatted_address: "123 Test St, Austin, TX 78704",
      address_components: [
        { long_name: "123", short_name: "123", types: ["street_number"] },
        { long_name: "Test St", short_name: "Test St", types: ["route"] },
        { long_name: "Austin", short_name: "Austin", types: ["locality"] },
        { long_name: "Texas", short_name: "TX", types: ["administrative_area_level_1"] },
        { long_name: "78704", short_name: "78704", types: ["postal_code"] },
      ],
    };
  }
}

describe("AddressInput — Autocomplete lifecycle", () => {
  let AddressInput: typeof AddressInputType;

  beforeEach(async () => {
    ctorSpy.mockClear();
    placeChangedCbs.length = 0;
    // Inject the mock Google SDK + short-circuit the script loader.
    Object.assign(window, {
      google: {
        maps: {
          places: { Autocomplete: MockAutocomplete },
        },
      },
      __cs_places_loader: Promise.resolve(),
    });
    // NEXT_PUBLIC_GOOGLE_MAPS_KEY is captured at module top-level, so we
    // must set it BEFORE importing the module. vi.resetModules + dynamic
    // import ensures each test gets a fresh module with the env seen.
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY = "ci-places-key";
    vi.resetModules();
    const mod = await import("@/components/marketing/AddressInput");
    AddressInput = mod.AddressInput;
  });

  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google;
    delete (window as unknown as { __cs_places_loader?: unknown }).__cs_places_loader;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  });

  it("creates Autocomplete exactly once even when the parent re-renders with new callbacks", async () => {
    // Parent re-renders whenever its bump counter changes. Each render hands
    // the child fresh function identities for `onChange` and `onPlace`.
    function Parent() {
      const [bump, setBump] = useState(0);
      const [value, setValue] = useState("");
      return (
        <div>
          <button type="button" data-testid="bump" onClick={() => setBump((b) => b + 1)}>
            bump {bump}
          </button>
          <AddressInput
            id="addr"
            value={value}
            onChange={(v) => setValue(v)}
            onPlace={() => {
              /* fresh identity per render */
            }}
          />
        </div>
      );
    }

    const { getByTestId } = render(<Parent />);

    // Wait a microtask for the loadPlaces promise to resolve + the effect
    // body to run.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ctorSpy).toHaveBeenCalledTimes(1);

    // Force three parent re-renders. With the pre-fix dep array, each of
    // these would have re-instantiated Autocomplete.
    await act(async () => {
      getByTestId("bump").click();
    });
    await act(async () => {
      getByTestId("bump").click();
    });
    await act(async () => {
      getByTestId("bump").click();
    });

    expect(ctorSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards place_changed to the latest onPlace callback (ref picks up updates)", async () => {
    // Confirms the ref pattern — a re-render between mount and fire swaps
    // the onPlace reference; the fire should hit the NEW callback, not the
    // stale one captured at mount.
    const calls: string[] = [];
    function Parent() {
      const [bump, setBump] = useState(0);
      return (
        <div>
          <button type="button" data-testid="bump" onClick={() => setBump((b) => b + 1)}>
            bump
          </button>
          <AddressInput
            id="addr"
            value=""
            onChange={() => {
              /* ignored */
            }}
            onPlace={() => calls.push(`render-${bump}`)}
          />
        </div>
      );
    }

    const { getByTestId } = render(<Parent />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Bump twice — the onPlace closure captures bump=2 by the time we fire.
    await act(async () => {
      getByTestId("bump").click();
    });
    await act(async () => {
      getByTestId("bump").click();
    });

    // Fire the (single) place_changed listener; latest onPlace should run.
    await act(async () => {
      placeChangedCbs[0]?.();
    });

    expect(calls).toEqual(["render-2"]);
  });
});
