import { expect, test } from "@playwright/test";

test.describe("auth gating", () => {
  test("unauthenticated access to /dashboard redirects to /sign-in", async ({ page }) => {
    const response = await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
    // The sign-in page heading is "Welcome back.".
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    expect(response?.ok()).toBe(true);
  });

  test("unauthenticated access to /admin redirects to /sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
  });

  test("sign-in page renders the magic-link form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    // Either the magic-link form (when Supabase is configured) or the
    // "not configured" alert should be visible — never neither.
    const formVisible = await page
      .getByLabel(/email/i)
      .first()
      .isVisible()
      .catch(() => false);
    const bannerVisible = await page
      .getByText(/sign-in is not configured/i)
      .isVisible()
      .catch(() => false);
    expect(formVisible || bannerVisible, "neither the form nor the banner rendered").toBe(true);
  });

  test("marketing header shows Sign in when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
  });
});
