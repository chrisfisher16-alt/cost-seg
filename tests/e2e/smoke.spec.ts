import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /cost segregation studies/i, level: 1 }),
  ).toBeVisible();
  // Brand sanity check — the Segra wordmark is present in the header.
  await expect(page.locator("header").first().getByText("Segra").first()).toBeVisible();
});

test("about page renders with Segra origin story", async ({ page }) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: /cost segregation, without the six-week wait/i, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /where the name comes from/i })).toBeVisible();
});
