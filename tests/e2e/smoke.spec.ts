import { expect, test } from "@playwright/test";

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /cost segregation studies/i, level: 1 }),
  ).toBeVisible();
});
