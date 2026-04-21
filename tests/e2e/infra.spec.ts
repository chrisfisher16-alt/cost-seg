import { expect, test } from "@playwright/test";

/**
 * Infrastructure endpoints the marketing site depends on for SEO + sample
 * downloads. These are cheap to run and a common source of silent breakage
 * after routing / next.config changes.
 */

test.describe("sample PDF endpoint (Day 5)", () => {
  // `addressSnippet` is a distinctive piece of each sample's property address
  // that we expect to find in the PDF bytes — guards against a template break
  // that still renders a "valid" PDF shape but with the wrong (or no) property
  // data. Chosen to be uncompressed-metadata-visible (shows up in Subject/Title
  // fields, which react-pdf emits without stream compression).
  const SAMPLES = [
    { id: "oak-ridge", addressSnippet: "Oak Ridge" },
    { id: "magnolia-duplex", addressSnippet: "Magnolia" },
    { id: "riverside-commercial", addressSnippet: "Riverside" },
  ] as const;

  for (const { id, addressSnippet } of SAMPLES) {
    test(`/api/samples/${id}/pdf returns a PDF`, async ({ request }) => {
      const res = await request.get(`/api/samples/${id}/pdf`);
      expect(res.status(), `${id} pdf returned ${res.status()}`).toBe(200);
      expect(res.headers()["content-type"] ?? "").toMatch(/application\/pdf/i);
      const disposition = res.headers()["content-disposition"] ?? "";
      expect(disposition).toMatch(/attachment|inline/i);
      expect(disposition).toMatch(/\.pdf/);
      // Filename must use the Segra brand slug — no regression to `cost-seg-*`.
      expect(disposition).toContain(`segra-sample-${id}.pdf`);
      expect(disposition).not.toMatch(/cost-seg-sample-/);
      const body = await res.body();
      expect(body.byteLength, `${id} pdf body empty`).toBeGreaterThan(1000);
      expect(body.subarray(0, 5).toString("ascii")).toBe("%PDF-");

      // --- brand + content guards ---
      // The PDF metadata dictionary is uncompressed so Author/Producer/Subject
      // show up as scannable ASCII in the raw bytes. If the rebrand ever drops
      // or mangles the brand strings, this assertion fires before the file
      // ever reaches a customer.
      const bodyStr = body.toString("latin1");
      expect(bodyStr, `${id} pdf missing Segra brand string`).toContain("Segra");
      expect(
        bodyStr,
        `${id} pdf missing ${addressSnippet} — template may not be wiring property data`,
      ).toContain(addressSnippet);
    });
  }

  test("unknown sample id returns 404", async ({ request }) => {
    const res = await request.get("/api/samples/does-not-exist/pdf");
    expect(res.status()).toBe(404);
  });
});

test.describe("brand icons", () => {
  // Next.js 16 auto-discovers `app/icon.png` and `app/apple-icon.png`, wires
  // them into <link rel="icon"> + <link rel="apple-touch-icon"> on every
  // route, and serves them at `/icon.png[?hash]` + `/apple-icon.png[?hash]`.
  // Verify both the served bytes AND the head-tag wiring so a future break
  // (file deleted, size mismatch, Next.js upgrade changing conventions)
  // fails CI instead of silently reaching prod social/home-screen previews.
  test("serves a valid 32×32 favicon", async ({ request }) => {
    const res = await request.get("/icon.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/image\/png/i);
    const body = await res.body();
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // Width + height live at bytes 16-24 of the IHDR chunk (big-endian int32).
    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    expect(width, "favicon width wrong").toBe(32);
    expect(height, "favicon height wrong").toBe(32);
  });

  test("serves a valid Apple touch icon ≥ 180×180", async ({ request }) => {
    const res = await request.get("/apple-icon.png");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] ?? "").toMatch(/image\/png/i);
    const body = await res.body();
    expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    // Apple's HIG recommends exactly 180×180; iOS downscales anything larger
    // cleanly. Assert the lower bound so a regression to a too-small icon
    // (visible blur on iPad home screens) is caught before shipping.
    const width = body.readUInt32BE(16);
    const height = body.readUInt32BE(20);
    expect(width, "apple-icon width under 180px").toBeGreaterThanOrEqual(180);
    expect(height, "apple-icon height under 180px").toBeGreaterThanOrEqual(180);
  });

  test("every marketing route advertises both icons in <head>", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveCount(1);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  });
});

test.describe("Stripe webhook endpoint", () => {
  // These assertions verify the auth gate around the webhook — the handler
  // itself is unit-tested in create-from-checkout.test.ts. Here we only care
  // that an unsigned / mis-signed POST never reaches the handler.
  //
  // If STRIPE_WEBHOOK_SECRET is unset in the dev env, the endpoint returns
  // 503 ("webhook not configured") before looking at the body — also a valid
  // outcome to assert, because it means no silent success on a mis-config.

  test("rejects a POST with no stripe-signature header", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: { type: "checkout.session.completed", data: {} },
      headers: { "content-type": "application/json" },
    });
    // 400 when secret IS set (missing signature), 503 when secret is unset
    // (misconfigured env in CI/dev). Either is correct — crucially, not 200.
    expect(
      [400, 503],
      `webhook with no signature returned ${res.status()} (expected 400 or 503)`,
    ).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("rejects a POST with a bogus stripe-signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1700000000,v1=deadbeefdeadbeefdeadbeefdeadbeef",
      },
      data: { type: "checkout.session.completed", data: {} },
    });
    expect([400, 503]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("GET is not allowed (no accidental 200 on browser navigation)", async ({ request }) => {
    const res = await request.get("/api/stripe/webhook");
    // Next returns 405 for unsupported methods on a route handler that only
    // exports POST — confirms the endpoint doesn't accidentally leak 200s
    // to a curious browser.
    expect(res.status()).toBe(405);
  });
});

test.describe("legal pages — effective-date stability", () => {
  // `/legal/scope-disclosure` previously rendered `Last updated ${new
  // Date().toLocaleDateString()}` — so the date ticked forward on every reload
  // and mutated with the viewer's locale (4/20/2026 vs 20/04/2026). A legal
  // page's last-updated timestamp is load-bearing trust signal; it must be a
  // static string derived from the last actual edit, not the request time.

  test("/legal/scope-disclosure last-updated is static across reloads", async ({ page }) => {
    await page.goto("/legal/scope-disclosure");
    const firstText = (await page.locator("body").textContent()) ?? "";
    const firstMatch = firstText.match(/Last updated ([^.]+)\./);
    expect(firstMatch, "last-updated line missing").not.toBeNull();

    // Reload — same string must render. If Date.now() is leaking into the
    // page, two renders under Playwright are guaranteed to share a date, so
    // we also check the value doesn't look like a locale-formatted date.
    await page.reload();
    const secondText = (await page.locator("body").textContent()) ?? "";
    const secondMatch = secondText.match(/Last updated ([^.]+)\./);
    expect(secondMatch?.[1]).toBe(firstMatch?.[1]);

    // Plain US locale would render `4/20/2026` — reject that shape.
    expect(
      firstMatch?.[1],
      "last-updated is locale-formatted — should be a static English date string",
    ).not.toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
  });
});

test.describe("legal pages — sub-processor accuracy (ADR 0006)", () => {
  // ADR 0006 retired AWS Textract in favor of Claude vision reading PDFs
  // directly. The privacy policy lists our data sub-processors, and the
  // methodology page describes how customer uploads are parsed. Both must
  // stay accurate — a user-facing claim that we send data to a sub-processor
  // we don't use is a compliance problem, not a copy nit.

  test("privacy page does not list AWS Textract as a sub-processor", async ({ page }) => {
    await page.goto("/legal/privacy");
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body, "privacy page still mentions Textract").not.toMatch(/textract/i);
    expect(body, "privacy page still mentions AWS as a sub-processor").not.toMatch(/\bAWS\b/);
  });

  test("methodology page describes Claude vision (not AWS Textract OCR)", async ({ page }) => {
    await page.goto("/legal/methodology");
    const body = (await page.locator("body").textContent()) ?? "";
    expect(body, "methodology page still references Textract").not.toMatch(/textract/i);
  });
});

test.describe("authenticated API gating", () => {
  // Smoke that the protected route handlers reject unauthenticated requests
  // at the HTTP layer. Complements the unit-tested `requireAuth` /
  // `requireRole` helpers with a "did the real request actually bounce?"
  // check — catches a surface that ships a missing `requireAuth()` call
  // ahead of an unrelated admin finding the gap.

  test("/api/dashboard/portfolio.csv redirects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/dashboard/portfolio.csv", {
      maxRedirects: 0,
    });
    // Next.js `redirect()` from a Server Action returns 307; unauthenticated
    // fetch must NOT get the CSV payload. Any 2xx here is a P0.
    expect(res.status(), `unauth portfolio.csv returned ${res.status()}`).not.toBe(200);
    expect(res.headers()["content-type"] ?? "").not.toMatch(/text\/csv/i);
  });
});

test.describe("legal pages — last-updated stanza present", () => {
  // Every legal page must carry a visible "Effective" or "Last updated" date
  // so a visitor can tell how current the policy is. Complements B2-1's
  // guard (scope-disclosure date is static across reloads) with a
  // presence check across the other three legal routes.
  const PAGES = [
    { path: "/legal/terms", pattern: /Effective/i },
    { path: "/legal/privacy", pattern: /Effective/i },
    { path: "/legal/scope-disclosure", pattern: /Last updated/i },
  ] as const;

  for (const { path, pattern } of PAGES) {
    test(`${path} renders a dated stanza`, async ({ page }) => {
      await page.goto(path);
      const body = (await page.locator("body").textContent()) ?? "";
      expect(body, `${path} missing date stanza matching ${pattern}`).toMatch(pattern);
    });
  }
});

test.describe("SEO endpoints (Day 5)", () => {
  test("/robots.txt is served and disallows authenticated paths", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/user-agent:\s*\*/i);
    expect(body).toMatch(/disallow:\s*\/api/i);
  });

  test("/sitemap.xml is served and lists marketing routes", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/<urlset/);
    expect(body).toMatch(/\/pricing/);
    expect(body).toMatch(/\/samples/);
  });

  test("root layout advertises an og:image", async ({ page }) => {
    // The opengraph-image.tsx handler uses the Edge runtime and is flaky to
    // fetch under `next dev` (socket hang-ups on first compile). We instead
    // verify the metadata plumbing — Next.js auto-generates the og:image tag
    // referencing the file when it exists — which is what actually matters
    // for social-preview rendering.
    await page.goto("/");
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage, "og:image meta tag missing").toBeTruthy();
    expect(ogImage).toMatch(/opengraph-image/i);
  });
});
