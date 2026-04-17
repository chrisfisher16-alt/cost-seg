import { expect, test } from "@playwright/test";

test.describe("get-started + checkout", () => {
  test("AI Report CTA routes to /get-started?tier=AI_REPORT", async ({ page }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await page.getByRole("link", { name: /start an ai report/i }).click();
    await expect(page).toHaveURL(/\/get-started\?tier=AI_REPORT/);
    await expect(page.getByRole("heading", { name: /start a ai report/i })).toBeVisible();
  });

  test("Engineer-Reviewed CTA routes to /get-started?tier=ENGINEER_REVIEWED", async ({ page }) => {
    await page.goto("/");
    await page.locator("#pricing").scrollIntoViewIfNeeded();
    await page.getByRole("link", { name: /start an engineered study/i }).click();
    await expect(page).toHaveURL(/\/get-started\?tier=ENGINEER_REVIEWED/);
    await expect(page.getByRole("heading", { name: /engineer-reviewed study/i })).toBeVisible();
  });

  test("get-started form surfaces 'Stripe not configured' in dev", async ({ page }) => {
    await page.goto("/get-started?tier=AI_REPORT");
    await expect(page.getByText(/stripe is not configured/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue to secure checkout/i })).toBeDisabled();
    await expect(page.getByText(/important scope disclosure/i)).toBeVisible();
  });

  test("get-started surfaces the cancelled banner when cancelled=1", async ({ page }) => {
    await page.goto("/get-started?tier=AI_REPORT&cancelled=1");
    await expect(page.getByText(/checkout was cancelled/i)).toBeVisible();
  });

  test("success page renders the receipt ref", async ({ page }) => {
    await page.goto("/get-started/success?session_id=cs_test_abcdefghijklmnop1234");
    await expect(page.getByRole("heading", { name: /payment received/i })).toBeVisible();
    await expect(page.getByText(/receipt ref/i)).toBeVisible();
    await expect(page.getByText(/mnop1234/)).toBeVisible();
  });
});

test.describe("stripe webhook", () => {
  test("rejects requests without a signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ type: "checkout.session.completed" }),
    });
    // 400 (missing signature) when configured, 503 (not configured) otherwise.
    // Either is an acceptable rejection path for an unsigned POST.
    expect([400, 503]).toContain(res.status());
  });
});
