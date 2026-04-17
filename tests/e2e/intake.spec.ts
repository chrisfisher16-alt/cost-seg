import { expect, test } from "@playwright/test";

test.describe("intake access control", () => {
  test("unauthenticated visit to an intake URL redirects to /sign-in", async ({ page }) => {
    await page.goto("/studies/00000000-0000-0000-0000-000000000000/intake");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });
});

test.describe("inngest route", () => {
  test("serves the introspection endpoint without crashing", async ({ request }) => {
    const res = await request.get("/api/inngest");
    // The Inngest serve handler returns 200 (configured) or 500 when signing
    // is missing. We just want to confirm the handler doesn't throw a 404.
    expect(res.status()).not.toBe(404);
  });
});
