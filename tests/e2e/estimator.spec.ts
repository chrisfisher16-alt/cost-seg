import { expect, test } from "@playwright/test";

test.describe("public estimator", () => {
  test("returns a year-one savings range for a short-term rental", async ({ page }) => {
    await page.goto("/");

    // Estimator lives on the landing page under #estimator.
    await page.locator("#estimator").scrollIntoViewIfNeeded();

    await page.getByLabel("Property type").selectOption("SHORT_TERM_RENTAL");
    await page.getByLabel("Purchase price (USD)").fill("500000");
    await page.getByRole("button", { name: /estimate my year-one savings/i }).click();

    const heading = page.getByText(/estimated year-one savings/i);
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // The result shows both a savings range and a reclassified basis; grab
    // the first dollar range (the hero amount).
    await expect(page.getByText(/\$[\d,]+–\$[\d,]+/).first()).toBeVisible();
    await expect(page.getByText(/important scope disclosure/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /get a real study/i })).toBeVisible();
  });

  test("shows an error when no purchase price is entered", async ({ page }) => {
    await page.goto("/");
    await page.locator("#estimator").scrollIntoViewIfNeeded();
    // Bypass browser-native required-field validation so we can assert on
    // the server-side error surfaced by the action.
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>("#price");
      if (input) input.required = false;
    });
    await page.getByRole("button", { name: /estimate my year-one savings/i }).click();
    await expect(page.getByText("Enter a purchase price.")).toBeVisible();
  });

  test("pricing section exposes both tiers with correct prices", async ({ page }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: "AI Report" })).toBeVisible();
    await expect(page.getByText("$295", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Engineer-Reviewed Study" })).toBeVisible();
    await expect(page.getByText("$1,495", { exact: true })).toBeVisible();
  });
});
