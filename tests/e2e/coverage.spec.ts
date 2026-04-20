import { expect, test } from "@playwright/test";

/**
 * Public-surface smoke. Every marketing route loads with a 200, renders its
 * expected h1, and doesn't emit a Next.js error overlay. Fast regression
 * signal for anyone touching marketing layout, tokens, or nav.
 */

const PUBLIC_ROUTES = [
  { path: "/", heading: /cost segregation studies/i },
  { path: "/pricing", heading: /three tiers/i },
  { path: "/samples", heading: /exactly what you/i },
  { path: "/samples/oak-ridge", heading: /sample report/i },
  { path: "/samples/magnolia-duplex", heading: /sample report/i },
  { path: "/samples/riverside-commercial", heading: /sample report/i },
  { path: "/compare", heading: /how we stack up/i },
  { path: "/faq", heading: /answers, in plain english/i },
  { path: "/about", heading: /cost segregation, rebuilt/i },
  { path: "/partners", heading: /cost seg your clients/i },
  { path: "/contact", heading: /we read every message/i },
  { path: "/legal/scope-disclosure", heading: /scope disclosure/i },
  { path: "/legal/methodology", heading: /methodology/i },
  { path: "/legal/privacy", heading: /privacy policy/i },
  { path: "/legal/terms", heading: /terms of service/i },
] as const;

test.describe("public route coverage", () => {
  for (const { path, heading } of PUBLIC_ROUTES) {
    test(`${path} renders without error`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `${path} returned ${response?.status()}`).toBe(200);
      await expect(
        page.getByRole("heading", { name: heading, level: 1 }),
        `h1 missing on ${path}`,
      ).toBeVisible();
    });
  }
});

test.describe("not-found + error fallbacks", () => {
  test("unknown route renders the global not-found page", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist-ever-12345");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /page not found/i, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /back to home/i })).toBeVisible();
  });

  test("unknown sample id renders not-found", async ({ page }) => {
    const response = await page.goto("/samples/this-sample-is-fake");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /page not found/i, level: 1 })).toBeVisible();
  });
});

test.describe("marketing header navigation", () => {
  test("top-level nav links all resolve to 200", async ({ page, request }) => {
    await page.goto("/");
    // Scope to the page header (not mobile nav) to avoid duplicate matches.
    const header = page.locator("header").first();
    const labels = [/^pricing$/i, /^sample reports$/i, /^compare$/i, /^faq$/i];
    for (const label of labels) {
      const href = await header.getByRole("link", { name: label }).first().getAttribute("href");
      expect(href, `no href for ${label}`).toBeTruthy();
      const res = await request.get(href!);
      expect(res.status(), `${href} returned ${res.status()}`).toBe(200);
    }
  });
});
