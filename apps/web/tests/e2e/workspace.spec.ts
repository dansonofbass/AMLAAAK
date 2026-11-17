import { test, expect } from "@playwright/test";
test("overview uses live API aggregates and coordinated filters", async ({
  page,
  request,
}) => {
  const summary = await (await request.get("/api/v1/dashboard/summary")).json();
  expect(summary.count).toBe(8);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Market overview." }),
  ).toBeVisible();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "8",
  );
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Selected city", exact: true })
    .click();
  await page.getByRole("option", { name: "Tehran", exact: true }).click();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "5",
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "8",
  );
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
});
test("widgets move with keyboard and reset", async ({ page }) => {
  await page.goto("/");
  const handle = page.getByRole("button", {
    name: "Move Asking price distribution widget",
  });
  await expect(handle).toBeVisible();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".w-price")).toHaveAttribute(
    "style",
    /translate\(10px, 0px\)/,
  );
  await page.getByRole("button", { name: "Reset widget layout" }).click();
  await expect(page.locator(".w-price")).toHaveAttribute(
    "style",
    /translate\(0px, 0px\)/,
  );
});
test("properties paginate sort and open accessible details", async ({
  page,
}) => {
  await page.goto("/properties");
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByRole("button", { name: "Previous page" }).click();
  await page
    .getByRole("combobox", { name: "Sort properties", exact: true })
    .click();
  await page.getByRole("option", { name: "Area", exact: true }).click();
  await page.locator(".detail-link").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("ILLUSTRATIVE RECORD");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Search listings").fill("not-a-real-city");
  await expect(page.getByText("No matching sales")).toBeVisible();
});
test("prediction validates inputs and calls the Python model when available", async ({
  page,
  request,
}) => {
  const status = await (await request.get("/api/v1/model/status")).json();
  await page.goto("/predict");
  await page.locator("[name=building_size]").fill("0");
  await page.getByRole("button", { name: "Estimate asking price" }).click();
  await expect(page.locator(".page-content [role=alert]")).toContainText(
    "correct",
  );
  await page.locator("[name=building_size]").fill("90");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/valuation") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Estimate asking price" }).click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByRole("region", { name: "Comparable property results" }),
  ).toBeVisible();
  if (status.available) {
    await expect(page.locator(".prediction-number")).toBeVisible();
    if (status.mode === "illustrative")
      await expect(page.getByText("DEMO:", { exact: false })).toBeVisible();
  }
  await page.screenshot({
    path: "test-results/prediction-desktop.png",
    fullPage: true,
  });
});
test("market analytics applies numeric filters and resets", async ({
  page,
}) => {
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Market analytics." }),
  ).toBeVisible();
  await page.getByLabel("area min").fill("200");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "2",
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "8",
  );
});
test("performance page shows artifact metadata or honest unavailable state", async ({
  page,
  request,
}) => {
  const metrics = await (await request.get("/api/v1/model/metrics")).json();
  await page.goto("/model");
  await expect(
    page.getByRole("heading", { name: "Model performance." }),
  ).toBeVisible();
  if (metrics.scores) {
    await expect(
      page.getByText("Training-median baseline", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Residuals are not available")).toBeVisible();
  } else
    await expect(
      page.getByText("No verified evaluation artifact"),
    ).toBeVisible();
});
test("mobile layout stacks widgets without document overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "8",
  );
  await expect(page.locator(".insights-panel")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Toggle insights", exact: true })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Contextual insights" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close insights" }).click();
  await page.goto("/predict");
  await expect(
    page.getByRole("heading", { name: "Price prediction." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("backend errors are presented without fabricated statistics", async ({
  page,
}) => {
  await page.route("**/api/v1/dashboard/summary**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "offline", message: "Test backend offline" },
      }),
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Analytics are unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".page-content [role=alert]")).toContainText(
    "Test backend offline",
  );
  await expect(page.locator(".kpi-grid")).toHaveCount(0);
});
