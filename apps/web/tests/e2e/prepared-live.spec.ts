import { test, expect } from "@playwright/test";

test("verified private prepared release works through the real frontend proxy", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.PREPARED_LIVE_E2E !== "1",
    "Explicit authenticated real prepared backend required",
  );
  test.setTimeout(90000);
  const summary = await (await request.get("/api/v1/dashboard/summary")).json();
  expect(summary.provenance.provider).toBe("prepared");
  expect(summary.provenance.revision).toBe(
    "8cc2a942d6d5d4b7cfa22e09a39d0223ff24019a",
  );
  expect(summary.count).toBe(420813);
  expect(summary.cities_count).toBe(417);
  const browserSourceRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("huggingface.co"))
      browserSourceRequests.push(req.url());
  });
  await page.goto("/");
  await expect(
    page.getByText("Prepared historical Divar archive", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".coverage-notice")).toContainText(
    "420,813 available historical sales",
  );
  await page
    .getByRole("combobox", { name: "Selected city", exact: true })
    .click();
  await page.getByRole("option", { name: "Tehran", exact: true }).click();
  await expect(page.locator(".coverage-notice")).toContainText("88,145 match");
  const facets = await (
    await request.get("/api/v1/data/facets?city=tehran")
  ).json();
  expect(facets.neighborhoods.length).toBe(344);
  await page.goto("/properties");
  await expect(page.locator("tbody tr")).toHaveCount(5);
  const previous = await page.locator("tbody tr").first().textContent();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("tbody tr").first()).not.toHaveText(previous || "");
  await page.goto("/predict");
  await page
    .getByRole("combobox", { name: "Property city", exact: true })
    .click();
  await page.getByRole("option", { name: "Tehran", exact: true }).click();
  await page.locator("[name=building_size]").fill("90");
  await page
    .getByRole("combobox", { name: "Number of Bedrooms", exact: true })
    .click();
  await page.getByRole("option", { name: "2", exact: true }).click();

  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/valuation") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Estimate Property Value" }).click();
  const result = await (await response).json();
  expect(result.prediction.model.version).toBe("267eff7c36f3");
  expect(result.prediction.predicted_price).toBeGreaterThan(0);
  expect(result.provenance.provider).toBe("prepared");
  expect(result.comparables).toHaveLength(8);
  await expect(page.locator(".comparable-card")).toHaveCount(8);
  expect(browserSourceRequests).toEqual([]); // HF authentication remains server-side.
});
