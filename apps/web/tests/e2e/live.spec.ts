import { test, expect } from "@playwright/test";
test.describe("live Hugging Face integration", () => {
  test.skip(
    process.env.LIVE_E2E !== "1",
    "Explicit live server and network opt-in required",
  );
  test("browser proxy reaches FastAPI and actual HF data", async ({
    page,
    request,
  }) => {
    const result = await (
      await request.get("/api/v1/dashboard/summary")
    ).json();
    expect(result.provenance.provider).toBe("huggingface");
    expect(result.count).toBeGreaterThan(0);
    expect(result.provenance.coverage.exhaustive).toBe(false);
    await page.goto("/");
    await expect(
      page.getByText("Historical Divar records · Hugging Face", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Selected city", exact: true })
      .click();
    await page.getByRole("option", { name: "Tehran", exact: true }).click();
    const filtered = await (
      await request.get("/api/v1/dashboard/summary?city=tehran")
    ).json();
    await expect(
      page.locator(".kpi-card").first().locator("strong"),
    ).toHaveText(String(filtered.count));
    await page.screenshot({
      path: "test-results/live-dashboard.png",
      fullPage: true,
    });
  });
  test("city neighborhoods and genuine comparable records are integrated", async ({
    page,
    request,
  }) => {
    const facets = await (
      await request.get("/api/v1/data/facets?city=tehran")
    ).json();
    expect(facets.neighborhoods.length).toBeGreaterThan(0);
    await page.goto("/predict");
    await page
      .getByRole("combobox", { name: "Property neighborhood", exact: true })
      .click();
    const option = page.getByRole("option").nth(1);
    await expect(option).toBeVisible();
    await option.click();
    await page.getByRole("button", { name: "Estimate asking price" }).click();
    await expect(page.locator(".comparable-card")).toHaveCount(8);
    await expect(
      page.getByText("Genuine Divar source record").first(),
    ).toBeVisible();
    await expect(page.locator(".prediction-number")).toBeVisible();
    await expect(
      page.getByText(
        "Historical asking prices, not active advertisements or completed sales.",
      ),
    ).not.toBeVisible();
    await page.screenshot({
      path: "test-results/live-valuation.png",
      fullPage: true,
    });
  });
});
