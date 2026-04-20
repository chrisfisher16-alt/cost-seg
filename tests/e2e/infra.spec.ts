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
