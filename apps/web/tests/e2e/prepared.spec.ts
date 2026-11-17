import { test, expect } from "@playwright/test";

test("prepared private adapter uses archive statistics filters pages and comparables", async ({ page, request }) => {
  test.skip(process.env.PREPARED_E2E !== "1", "Requires explicit synthetic prepared-provider QA server");
  const summary = await (await request.get("/api/v1/dashboard/summary")).json();
  expect(summary.provenance.provider).toBe("prepared");
  expect(summary.count).toBe(18); // Synthetic test archive, never a production result.
  expect(summary.provenance.coverage.source_processing_complete).toBe(true);
  await page.goto("/");
  await expect(page.getByText("Prepared historical Divar archive", { exact: true })).toBeVisible();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText("18");
  await page.getByRole("combobox", { name: "Selected city", exact: true }).click();
  await page.getByRole("option", { name: "Tehran", exact: true }).click();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText("9");
  const filtered = await (await request.get("/api/v1/properties?city=tehran&neighborhood=central&area_min=74")).json();
  expect(filtered.total).toBe(4);
  expect(filtered.items.every((p: { neighborhood_slug: string }) => p.neighborhood_slug === "central")).toBe(true);
  await page.goto("/properties");
  await page.getByRole("combobox", { name: "Selected city", exact: true }).click();
  await page.getByRole("option", { name: "Tehran", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("combobox", { name: "Neighborhood filter", exact: true }).click();
  await page.getByRole("option", { name: "Central", exact: true }).click();
  await page.locator(".detail-link").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/predict");
  await page.getByRole("button", { name: "Estimate asking price" }).click();
  await expect(page.locator(".comparable-card")).toHaveCount(6);
  await expect(page.getByRole("region", { name: "Comparable property results" })).toBeVisible();
  await page.screenshot({ path: "test-results/prepared-synthetic-valuation.png", fullPage: true });
});
