import { expect, test } from "@playwright/test";

/**
 * Viewport regression guard — every marketing + sign-in route must render
 * without horizontal overflow at 360 / 768 / 1280 widths (mobile / tablet /
 * desktop). Horizontal scroll on a public page is almost always a CSS
 * mistake: a sibling with min-content width, a fixed-pixel image, a
 * pre/code block without max-width, or a flex child with text-nowrap on
 * content wider than its container.
 *
 * 14 routes × 3 viewports = 42 assertions. Adds ~20s to the e2e run —
 * cheap for the coverage (every new marketing page or CSS change gets
 * checked across mobile/tablet/desktop without the author remembering to
 * resize their browser).
 *
 * Added in Bucket 2 (see master-prompt §4); the initial landing run found
 * zero overflows — this file exists to keep it that way.
 */

const ROUTES = [
  "/",
  "/pricing",
  "/samples",
  "/samples/oak-ridge",
  "/compare",
  "/faq",
  "/about",
  "/contact",
  "/partners",
  "/legal/scope-disclosure",
  "/legal/methodology",
  "/legal/privacy",
  "/legal/terms",
  "/sign-in",
];

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 780 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const route of ROUTES) {
      test(`${route} has no horizontal overflow`, async ({ page }) => {
        await page.goto(route, { waitUntil: "networkidle" });
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        const delta = scrollWidth - innerWidth;
        expect(delta, `${route} overflows ${vp.name} by ${delta}px`).toBeLessThanOrEqual(2);
      });
    }
  });
}
