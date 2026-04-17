import { expect, test } from "@playwright/test";

test.describe("admin access control", () => {
  test("unauthenticated visit to /admin redirects to /sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated visit to /admin/engineer-queue redirects to /sign-in", async ({ page }) => {
    await page.goto("/admin/engineer-queue");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated visit to /admin/studies/[id] redirects to /sign-in", async ({ page }) => {
    await page.goto("/admin/studies/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
