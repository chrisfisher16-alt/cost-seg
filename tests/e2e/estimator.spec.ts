import { expect, test } from "@playwright/test";

test.describe("public estimator", () => {
  test("returns a year-one savings range for a short-term rental", async ({ page }) => {
    await page.goto("/");
    // Playwright auto-scrolls + retries on re-renders, so anchor on the
    // submit button (always rendered inside the estimator) rather than
    // scrolling by id — hydration re-renders detach the #estimator node.
    const submit = page.getByRole("button", { name: /estimate my year-one savings/i });
    await submit.waitFor();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /short-term rental/i }).click();
    await page.getByLabel(/purchase price/i).fill("500000");
    await submit.click();

    await expect(page.getByText(/estimated year-one savings/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/\$[\d,]+–\$[\d,]+/).first()).toBeVisible();
    await expect(page.getByText(/important scope disclosure/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /start a real study/i })).toBeVisible();
  });

  test("shows an error when no purchase price is entered", async ({ page }) => {
    await page.goto("/");
    const submit = page.getByRole("button", { name: /estimate my year-one savings/i });
    await submit.waitFor();
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>("#price");
      if (input) input.required = false;
    });
    await submit.click();
    await expect(page.getByText(/enter a purchase price/i)).toBeVisible();
  });

  test("pricing section exposes both tiers with correct prices", async ({ page }) => {
    await page.goto("/");
    const pricing = page.locator("#pricing");
    await pricing.waitFor();
    await expect(pricing.getByRole("heading", { name: "AI Report", level: 3 })).toBeVisible();
    await expect(pricing.getByText("$295", { exact: true })).toBeVisible();
    await expect(
      pricing.getByRole("heading", { name: "Engineer-Reviewed Study", level: 3 }),
    ).toBeVisible();
    await expect(pricing.getByText("$1,495", { exact: true })).toBeVisible();
  });
});
