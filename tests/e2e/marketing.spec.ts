import { expect, test } from "@playwright/test";

test.describe("marketing coverage", () => {
  test("home renders the required sections", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /cost segregation studies/i, level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: /how it works/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /run a free estimate/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /pick the report you need/i })).toBeVisible();
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

test.describe("get-started form validation (Stripe not configured)", () => {
  test("requires email, property type, and submits disabled without Stripe env", async ({
    page,
  }) => {
    await page.goto("/get-started?tier=AI_REPORT");
    await expect(page.getByRole("button", { name: /continue to secure checkout/i })).toBeDisabled();
    await expect(page.getByLabel(/email/i, { exact: false }).first()).toBeVisible();
    await expect(page.getByLabel(/property type/i)).toBeVisible();
  });
});
