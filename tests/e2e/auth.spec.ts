import { expect, test } from "@playwright/test";

test.describe("auth gating", () => {
  test("unauthenticated access to /dashboard redirects to /sign-in", async ({ page }) => {
    const response = await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    expect(response?.ok()).toBe(true);
  });

  test("unauthenticated access to /admin redirects to /sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
  });

  test("sign-in page renders and surfaces the 'not configured' banner in dev", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    // Without NEXT_PUBLIC_SUPABASE_URL set, the form should surface a config hint.
    await expect(page.getByText(/sign-in is not configured/i)).toBeVisible();
  });

  test("marketing header shows Sign in when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^sign in$/i })).toBeVisible();
  });
});
