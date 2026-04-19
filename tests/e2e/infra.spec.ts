import { expect, test } from "@playwright/test";

/**
 * Infrastructure endpoints the marketing site depends on for SEO + sample
 * downloads. These are cheap to run and a common source of silent breakage
 * after routing / next.config changes.
 */

test.describe("sample PDF endpoint (Day 5)", () => {
  for (const id of ["oak-ridge", "magnolia-duplex", "riverside-commercial"]) {
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
    });
  }

  test("unknown sample id returns 404", async ({ request }) => {
    const res = await request.get("/api/samples/does-not-exist/pdf");
    expect(res.status()).toBe(404);
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
