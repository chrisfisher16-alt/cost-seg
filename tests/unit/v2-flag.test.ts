import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isV2ClassifierEnabled,
  isV2PdfEnabled,
  isV2PhotosEnabled,
  isV2PropertyEnrichEnabled,
  isV2ReviewEnabled,
  isV2ReviewEnforceEnabled,
  isV2WebSearchEnabled,
} from "@/lib/features/v2-report";

/**
 * Flag semantics for the v2 Phase 1 rollout. Match the rest of the repo's
 * env-var conventions (isStripeConfigured / isSupabaseConfigured):
 *   • Missing / empty / "0" / "false" → OFF
 *   • "1" / "true" (case insensitive) → ON
 */

describe("isV2PhotosEnabled", () => {
  const originalValue = process.env.V2_REPORT_PHOTOS;

  beforeEach(() => {
    delete process.env.V2_REPORT_PHOTOS;
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.V2_REPORT_PHOTOS;
    } else {
      process.env.V2_REPORT_PHOTOS = originalValue;
    }
  });

  it("defaults to OFF when the env var is unset", () => {
    expect(isV2PhotosEnabled()).toBe(false);
  });

  it("is OFF for empty string, 0, false", () => {
    process.env.V2_REPORT_PHOTOS = "";
    expect(isV2PhotosEnabled()).toBe(false);
    process.env.V2_REPORT_PHOTOS = "0";
    expect(isV2PhotosEnabled()).toBe(false);
    process.env.V2_REPORT_PHOTOS = "false";
    expect(isV2PhotosEnabled()).toBe(false);
    process.env.V2_REPORT_PHOTOS = "no";
    expect(isV2PhotosEnabled()).toBe(false);
  });

  it("is ON for 1 / true / TRUE", () => {
    process.env.V2_REPORT_PHOTOS = "1";
    expect(isV2PhotosEnabled()).toBe(true);
    process.env.V2_REPORT_PHOTOS = "true";
    expect(isV2PhotosEnabled()).toBe(true);
    process.env.V2_REPORT_PHOTOS = "TRUE";
    expect(isV2PhotosEnabled()).toBe(true);
    process.env.V2_REPORT_PHOTOS = "  true  ";
    expect(isV2PhotosEnabled()).toBe(true);
  });
});

describe("isV2ClassifierEnabled", () => {
  const original = process.env.V2_REPORT_CLASSIFIER;
  beforeEach(() => {
    delete process.env.V2_REPORT_CLASSIFIER;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.V2_REPORT_CLASSIFIER;
    else process.env.V2_REPORT_CLASSIFIER = original;
  });

  it("defaults OFF when unset", () => {
    expect(isV2ClassifierEnabled()).toBe(false);
  });

  it("toggles on 1 / true", () => {
    process.env.V2_REPORT_CLASSIFIER = "1";
    expect(isV2ClassifierEnabled()).toBe(true);
    process.env.V2_REPORT_CLASSIFIER = "true";
    expect(isV2ClassifierEnabled()).toBe(true);
  });

  it("stays OFF for false / 0 / empty", () => {
    process.env.V2_REPORT_CLASSIFIER = "0";
    expect(isV2ClassifierEnabled()).toBe(false);
    process.env.V2_REPORT_CLASSIFIER = "false";
    expect(isV2ClassifierEnabled()).toBe(false);
    process.env.V2_REPORT_CLASSIFIER = "";
    expect(isV2ClassifierEnabled()).toBe(false);
  });

  it("is independent of the photos flag", () => {
    process.env.V2_REPORT_PHOTOS = "1";
    expect(isV2ClassifierEnabled()).toBe(false);
    expect(isV2PhotosEnabled()).toBe(true);
  });
});

describe("isV2WebSearchEnabled", () => {
  const original = process.env.V2_REPORT_WEB_SEARCH;
  beforeEach(() => {
    delete process.env.V2_REPORT_WEB_SEARCH;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.V2_REPORT_WEB_SEARCH;
    else process.env.V2_REPORT_WEB_SEARCH = original;
  });

  it("defaults OFF", () => {
    expect(isV2WebSearchEnabled()).toBe(false);
  });

  it("toggles on true / 1", () => {
    process.env.V2_REPORT_WEB_SEARCH = "1";
    expect(isV2WebSearchEnabled()).toBe(true);
    process.env.V2_REPORT_WEB_SEARCH = "true";
    expect(isV2WebSearchEnabled()).toBe(true);
  });

  it("is independent of the classifier + photos flags", () => {
    process.env.V2_REPORT_CLASSIFIER = "1";
    process.env.V2_REPORT_PHOTOS = "1";
    expect(isV2WebSearchEnabled()).toBe(false);
  });
});

describe("isV2PropertyEnrichEnabled", () => {
  const original = process.env.V2_REPORT_PROPERTY_ENRICH;
  beforeEach(() => {
    delete process.env.V2_REPORT_PROPERTY_ENRICH;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.V2_REPORT_PROPERTY_ENRICH;
    else process.env.V2_REPORT_PROPERTY_ENRICH = original;
  });

  it("defaults OFF", () => {
    expect(isV2PropertyEnrichEnabled()).toBe(false);
  });

  it("toggles on 1 / true", () => {
    process.env.V2_REPORT_PROPERTY_ENRICH = "1";
    expect(isV2PropertyEnrichEnabled()).toBe(true);
    process.env.V2_REPORT_PROPERTY_ENRICH = "true";
    expect(isV2PropertyEnrichEnabled()).toBe(true);
  });

  it("is independent of the other v2 flags", () => {
    process.env.V2_REPORT_CLASSIFIER = "1";
    process.env.V2_REPORT_PHOTOS = "1";
    process.env.V2_REPORT_WEB_SEARCH = "1";
    expect(isV2PropertyEnrichEnabled()).toBe(false);
  });
});

describe("isV2PdfEnabled", () => {
  const original = process.env.V2_REPORT_PDF;
  beforeEach(() => {
    delete process.env.V2_REPORT_PDF;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.V2_REPORT_PDF;
    else process.env.V2_REPORT_PDF = original;
  });

  it("defaults OFF", () => {
    expect(isV2PdfEnabled()).toBe(false);
  });

  it("toggles on 1 / true", () => {
    process.env.V2_REPORT_PDF = "1";
    expect(isV2PdfEnabled()).toBe(true);
    process.env.V2_REPORT_PDF = "true";
    expect(isV2PdfEnabled()).toBe(true);
  });
});

describe("isV2ReviewEnabled", () => {
  const original = process.env.V2_REPORT_REVIEW;
  beforeEach(() => {
    delete process.env.V2_REPORT_REVIEW;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.V2_REPORT_REVIEW;
    else process.env.V2_REPORT_REVIEW = original;
  });

  it("defaults OFF", () => {
    expect(isV2ReviewEnabled()).toBe(false);
  });

  it("toggles on 1 / true", () => {
    process.env.V2_REPORT_REVIEW = "1";
    expect(isV2ReviewEnabled()).toBe(true);
    process.env.V2_REPORT_REVIEW = "true";
    expect(isV2ReviewEnabled()).toBe(true);
  });
});

describe("isV2ReviewEnforceEnabled", () => {
  const original = process.env.V2_REPORT_REVIEW_ENFORCE;
  beforeEach(() => {
    delete process.env.V2_REPORT_REVIEW_ENFORCE;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.V2_REPORT_REVIEW_ENFORCE;
    else process.env.V2_REPORT_REVIEW_ENFORCE = original;
  });

  it("defaults OFF so review runs in telemetry-only mode by default", () => {
    expect(isV2ReviewEnforceEnabled()).toBe(false);
  });

  it("toggles on 1 / true", () => {
    process.env.V2_REPORT_REVIEW_ENFORCE = "1";
    expect(isV2ReviewEnforceEnabled()).toBe(true);
    process.env.V2_REPORT_REVIEW_ENFORCE = "true";
    expect(isV2ReviewEnforceEnabled()).toBe(true);
  });

  it("is independent of V2_REPORT_REVIEW", () => {
    process.env.V2_REPORT_REVIEW = "1";
    expect(isV2ReviewEnforceEnabled()).toBe(false);
  });
});
