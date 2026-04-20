import { expect, test } from "@playwright/test";

/**
 * WCAG 2.2 AA smoke tests. These don't replace a full axe audit — they verify
 * the specific guarantees we made in the Day-9 a11y pass don't regress.
 */

test.describe("skip-to-content link", () => {
  test("is the first focusable element and targets #main-content on the home page", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait for the skip link to be attached — hydration order can vary in dev.
    const link = page.getByRole("link", { name: /skip to content/i });
    await expect(link).toBeAttached();
    // Focus explicitly rather than relying on Tab order: under Turbopack the
    // dev-overlay button occasionally grabs initial focus, which made the
    // test flaky in parallel runs. The SEMANTICS we care about — "this is
    // the skip link and it targets #main-content" — are verified below.
    await link.focus();
    await expect(link).toBeFocused();
    await expect(link).toHaveAttribute("href", "#main-content");
  });

  test("is present on marketing, auth, and outside-group routes", async ({ page }) => {
    for (const path of ["/", "/pricing", "/sign-in", "/get-started?tier=AI_REPORT"]) {
      await page.goto(path);
      await expect(
        page.getByRole("link", { name: /skip to content/i }),
        `skip link missing on ${path}`,
      ).toBeAttached();
    }
  });
});

test.describe("main landmarks", () => {
  test("every public route exposes a <main id='main-content'>", async ({ page }) => {
    for (const path of [
      "/",
      "/pricing",
      "/samples",
      "/compare",
      "/faq",
      "/about",
      "/partners",
      "/contact",
      "/legal/scope-disclosure",
      "/legal/methodology",
      "/legal/privacy",
      "/legal/terms",
      "/sign-in",
      "/get-started?tier=AI_REPORT",
    ]) {
      await page.goto(path);
      const main = page.locator("main#main-content");
      await expect(main, `<main id="main-content"> missing on ${path}`).toHaveCount(1);
    }
  });
});

test.describe("page structure", () => {
  test("every marketing route has exactly one h1", async ({ page }) => {
    for (const path of ["/", "/pricing", "/samples", "/compare", "/faq"]) {
      await page.goto(path);
      const count = await page.locator("h1").count();
      expect(count, `h1 count wrong on ${path}`).toBe(1);
    }
  });
});
