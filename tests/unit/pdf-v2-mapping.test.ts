import { describe, expect, it, vi } from "vitest";

import {
  isV2Schedule,
  mapEnrichment,
  mapV2LineItems,
  pickHeroPhotoDocumentId,
  type V2LineItem,
} from "@/lib/studies/pdf-v2-mapping";

/**
 * Unit tests for the v2 → PDF props mapping (ADR 0012). The helpers
 * are pure — the photo loader is the only one that hits storage, which
 * we stub.
 */

describe("isV2Schedule", () => {
  it("returns true for { schema: 'v2', ... }", () => {
    expect(isV2Schedule({ schema: "v2", schedule: { lineItems: [] } })).toBe(true);
  });
  it("returns false for v1 / undefined / malformed", () => {
    expect(isV2Schedule({ schedule: { lineItems: [] } })).toBe(false);
    expect(isV2Schedule(null)).toBe(false);
    expect(isV2Schedule(undefined)).toBe(false);
    expect(isV2Schedule({ schema: "v1" })).toBe(false);
  });
});

describe("mapV2LineItems", () => {
  const sampleItem: V2LineItem = {
    category: "5yr",
    name: "Chrome double towel bar",
    quantity: 1,
    unit: "each",
    source: "pricesearch",
    comparable: {
      description: "24-inch residential-grade chrome double towel bar",
      unitCostCents: 5_200,
      sourceUrl: "https://www.target.com/p/A-12345",
    },
    physicalMultiplier: 1,
    physicalJustification: "Chrome finish intact, no scratches.",
    functionalMultiplier: 1,
    functionalJustification: "Timeless fixture; no obsolescence.",
    timeMultiplier: 0.9434,
    timeBasis: "BCI 2025 → 2022.",
    locationMultiplier: 1.09,
    locationBasis: "Austin metro AMF 1.09.",
    adjustedCostCents: 5_348,
    photoDocumentId: "photo-1",
    rationale: "Photo-observed bathroom fixture.",
  };

  it("maps adjustedCostCents onto amountCents so MACRS math keeps working", () => {
    const [out] = mapV2LineItems([sampleItem], new Map());
    expect(out).toBeDefined();
    expect(out?.amountCents).toBe(5_348);
  });

  it("copies comparable description + sourceUrl and all six multipliers", () => {
    const [out] = mapV2LineItems([sampleItem], new Map());
    expect(out?.comparableDescription).toMatch(/chrome double towel bar/);
    expect(out?.comparableSourceUrl).toBe("https://www.target.com/p/A-12345");
    expect(out?.physicalMultiplier).toBe(1);
    expect(out?.functionalMultiplier).toBe(1);
    expect(out?.timeMultiplier).toBeCloseTo(0.9434);
    expect(out?.locationMultiplier).toBeCloseTo(1.09);
  });

  it("resolves photoDataUri via the caller-supplied map when documentId matches", () => {
    const map = new Map<string, string>([["photo-1", "data:image/png;base64,AAA"]]);
    const [out] = mapV2LineItems([sampleItem], map);
    expect(out?.photoDataUri).toBe("data:image/png;base64,AAA");
  });

  it("leaves photoDataUri undefined when no map entry matches", () => {
    const [out] = mapV2LineItems([sampleItem], new Map());
    expect(out?.photoDataUri).toBeUndefined();
  });

  it("threads isResidual through unchanged", () => {
    const residual = { ...sampleItem, isResidual: true, photoDocumentId: undefined };
    const [out] = mapV2LineItems([residual], new Map());
    expect(out?.isResidual).toBe(true);
  });
});

describe("mapEnrichment", () => {
  it("returns null for non-objects", () => {
    expect(mapEnrichment(null)).toBeNull();
    expect(mapEnrichment(undefined)).toBeNull();
    expect(mapEnrichment("string")).toBeNull();
    expect(mapEnrichment(42)).toBeNull();
  });

  it("keeps numeric fields and strings, null-coerces missing / malformed", () => {
    const out = mapEnrichment({
      squareFeet: 2197,
      yearBuilt: 1920,
      constructionType: "wood_frame",
      roofType: "metal",
      lotSizeSqft: 7884,
      assessorUrl: "https://gillespiecad.org/property/R012345",
      listingUrl: "https://www.redfin.com/TX/Fredericksburg/207-S-Edison-St-78624",
      bedrooms: 3,
      bathrooms: 1,
    });
    expect(out).not.toBeNull();
    expect(out?.squareFeet).toBe(2197);
    expect(out?.constructionType).toBe("wood_frame");
    expect(out?.assessorUrl).toMatch(/gillespiecad/);
  });

  it("drops non-numeric / empty-string values to null", () => {
    const out = mapEnrichment({
      squareFeet: "2197", // wrong type
      constructionType: "",
      assessorUrl: null,
    });
    expect(out).not.toBeNull();
    expect(out?.squareFeet).toBeNull();
    expect(out?.constructionType).toBeNull();
    expect(out?.assessorUrl).toBeNull();
  });
});

describe("loadPhotoDataUrisByDocumentId", () => {
  it("downloads, base64-encodes, and keys results by documentId", async () => {
    const fakeBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic
    vi.doMock("@/lib/storage/studies", () => ({
      downloadStudyFile: vi.fn().mockResolvedValue({
        arrayBuffer: async () => fakeBytes.buffer,
      }),
    }));
    vi.resetModules();
    const mod = await import("@/lib/studies/pdf-v2-mapping");
    const result = await mod.loadPhotoDataUrisByDocumentId([
      { documentId: "p1", storagePath: "s/p1.jpg", mimeType: "image/jpeg" },
    ]);
    expect(result.get("p1")).toBe(
      `data:image/jpeg;base64,${Buffer.from(fakeBytes).toString("base64")}`,
    );
    vi.doUnmock("@/lib/storage/studies");
    vi.resetModules();
  });

  it("silently skips a photo whose download throws, preserving other entries", async () => {
    const fakeBytes = new Uint8Array([1, 2, 3]);
    const downloadStudyFile = vi
      .fn()
      .mockImplementationOnce(async () => ({ arrayBuffer: async () => fakeBytes.buffer }))
      .mockRejectedValueOnce(new Error("nope"));
    vi.doMock("@/lib/storage/studies", () => ({ downloadStudyFile }));
    vi.resetModules();
    const mod = await import("@/lib/studies/pdf-v2-mapping");
    const result = await mod.loadPhotoDataUrisByDocumentId([
      { documentId: "p1", storagePath: "s/p1.jpg", mimeType: "image/jpeg" },
      { documentId: "p2", storagePath: "s/p2.jpg", mimeType: "image/jpeg" },
    ]);
    expect(result.has("p1")).toBe(true);
    expect(result.has("p2")).toBe(false);
    vi.doUnmock("@/lib/storage/studies");
    vi.resetModules();
  });
});

describe("pickHeroPhotoDocumentId — cover-hero selection", () => {
  it("returns null for an empty candidate list", () => {
    expect(pickHeroPhotoDocumentId([])).toBeNull();
  });

  it("picks exterior_front over every other roomType", () => {
    expect(
      pickHeroPhotoDocumentId([
        { documentId: "kitchen", roomType: "kitchen" },
        { documentId: "front", roomType: "exterior_front" },
        { documentId: "yard", roomType: "yard" },
      ]),
    ).toBe("front");
  });

  it("falls through the exterior priority chain when front is absent", () => {
    expect(
      pickHeroPhotoDocumentId([
        { documentId: "yard", roomType: "yard" },
        { documentId: "rear", roomType: "exterior_rear" },
        { documentId: "side", roomType: "exterior_side" },
      ]),
    ).toBe("side");
    expect(
      pickHeroPhotoDocumentId([
        { documentId: "yard", roomType: "yard" },
        { documentId: "rear", roomType: "exterior_rear" },
      ]),
    ).toBe("rear");
    expect(
      pickHeroPhotoDocumentId([
        { documentId: "yard", roomType: "yard" },
        { documentId: "kitchen", roomType: "kitchen" },
      ]),
    ).toBe("yard");
  });

  it("falls back to the first analyzed photo when no exterior/yard match", () => {
    expect(
      pickHeroPhotoDocumentId([
        { documentId: "p1", roomType: null },
        { documentId: "p2", roomType: "kitchen" },
        { documentId: "p3", roomType: "primary_bath" },
      ]),
    ).toBe("p2");
  });

  it("falls back to the first photo when none have roomType at all", () => {
    expect(pickHeroPhotoDocumentId([{ documentId: "p1" }, { documentId: "p2" }])).toBe("p1");
  });
});
