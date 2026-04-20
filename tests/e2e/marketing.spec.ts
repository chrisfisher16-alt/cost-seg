import { expect, test } from "@playwright/test";

test.describe("marketing coverage", () => {
  test("home renders the required sections", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /cost segregation studies/i, level: 1 }),
    ).toBeVisible();
    // "How it works" is the eyebrow; the actual h2 describes the flow.
    await expect(
      page.getByRole("heading", {
        name: /from purchase price to year-one deductions/i,
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /see your year-one savings in 30 seconds/i,
        level: 2,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /pay for exactly the report you need/i,
        level: 2,
      }),
    ).toBeVisible();
  });

  test("footer shows the scope-disclosure line", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .locator("footer")
        .getByText(/not engineered cost segregation studies under IRS Publication 5653/i),
    ).toBeVisible();
  });

  test("hero CTA scrolls to the estimator section", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /estimate your savings/i })
      .first()
      .click();
    await expect(page).toHaveURL(/#estimator$/);
  });
});

test.describe("pricing responsive layout", () => {
  // Three viewports we explicitly care about:
  //   375 — iPhone SE / narrow Android (must stack cleanly)
  //   768 — iPad portrait / md breakpoint (three cards side-by-side)
  //   1280 — laptop / lg+ (three cards with breathing room)
  const PRICING_HEADING = /pay for exactly the report you need/i;

  test("mobile (375px): pricing tiers stack vertically", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/pricing");
    const pricingHeading = page.getByRole("heading", { name: PRICING_HEADING, level: 2 });
    await expect(pricingHeading).toBeVisible();

    // All three tier labels must be reachable — they're just in a single
    // column at this viewport.
    await expect(page.getByRole("heading", { name: /^diy self-serve$/i, level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^ai report$/i, level: 3 })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^engineer-reviewed study$/i, level: 3 }),
    ).toBeVisible();

    // The grid must not overflow horizontally — a common source of ugly
    // horizontal-scroll bugs after Tailwind class swaps.
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth, "horizontal overflow on mobile").toBeLessThanOrEqual(375);
  });

  test("tablet (768px): three tier cards render side-by-side", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/pricing");

    const tierCards = page.locator(
      'h3:text-matches("^(DIY Self-Serve|AI Report|Engineer-Reviewed Study)$", "i")',
    );
    await expect(tierCards).toHaveCount(3);

    // Cards must sit on the same vertical row — their top offsets differ by
    // <50px only if they're beside each other. If the grid fell back to a
    // single column, the middle card's top would be +500px below the first.
    const tops = await tierCards.evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).getBoundingClientRect().top),
    );
    const maxDelta = Math.max(...tops) - Math.min(...tops);
    expect(maxDelta, `tier cards stacked at 768px (top delta ${maxDelta}px)`).toBeLessThan(50);
  });
});

test.describe("get-started form", () => {
  test("renders the form with email and property type fields", async ({ page }) => {
    await page.goto("/get-started?tier=AI_REPORT");
    // Heading reads "Start your ai report." (tier label lowercased).
    await expect(page.getByRole("heading", { name: /start your/i, level: 1 })).toBeVisible();
    await expect(page.getByLabel(/email/i, { exact: false }).first()).toBeVisible();
    // Radix Select: Field label is not a real <label for=...>, so assert on
    // the visible label text instead.
    await expect(page.getByText(/^property type/i).first()).toBeVisible();
    await expect(page.getByRole("combobox").first()).toBeVisible();
  });
});
