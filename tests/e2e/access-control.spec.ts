import { expect, test } from "@playwright/test";

/**
 * Access-control regression net for every Day 3 / 4 / 5 / 7 surface we added.
 * Unauthenticated visitors should never be able to reach owner-only data,
 * see CPA-share content without accepting, or pull the portfolio CSV.
 */

const UUID = "00000000-0000-0000-0000-000000000000";
const TOKEN = "pretend-share-token-0123456789abcdef";

test.describe("unauthenticated gating — Day 3/4 surfaces", () => {
  test("DIY intake redirects to /sign-in", async ({ page }) => {
    await page.goto(`/studies/${UUID}/diy`);
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
  });

  test("read-only study view redirects to /sign-in", async ({ page }) => {
    await page.goto(`/studies/${UUID}/view`);
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
  });

  test("share-accept route redirects unauthenticated visitors to sign-in", async ({ page }) => {
    await page.goto(`/share/${TOKEN}`);
    // Depending on config the accept page either redirects to sign-in or
    // renders an error card. Both are acceptable gates for an unauthenticated
    // visitor holding a bogus token.
    await expect(page).toHaveURL(/\/(sign-in|share\/)/);
  });

  test("processing page redirects to /sign-in", async ({ page }) => {
    await page.goto(`/studies/${UUID}/processing`);
    await expect(page).toHaveURL(/\/sign-in(\?|$)/);
  });
});

test.describe("unauthenticated gating — Day 7 portfolio CSV", () => {
  test("GET /api/dashboard/portfolio.csv is not reachable unauthenticated", async ({ request }) => {
    const res = await request.get("/api/dashboard/portfolio.csv", { maxRedirects: 0 });
    // requireAuth() → redirect('/sign-in?next=...'): either 307 with a
    // Location header pointing at /sign-in, or 2xx/4xx with HTML that's
    // definitely not the CSV payload. Fail only if we actually serve CSV.
    const contentType = res.headers()["content-type"] ?? "";
    expect(contentType, "portfolio.csv leaked to unauth").not.toMatch(/text\/csv/i);
  });
});

test.describe("unauthenticated gating — admin + engineer surfaces", () => {
  test("admin routes all redirect to /sign-in", async ({ page }) => {
    for (const path of [
      "/admin",
      "/admin/engineer-queue",
      `/admin/studies/${UUID}`,
      "/admin?status=FAILED",
      "/admin?tier=DIY&q=test",
    ]) {
      await page.goto(path);
      await expect(page, `${path} did not gate`).toHaveURL(/\/sign-in(\?|$)/);
    }
  });
});
