import { test, expect } from "@playwright/test";
async function city(page: import("@playwright/test").Page) {
  await page
    .getByRole("combobox", { name: "Selected city", exact: true })
    .click();
  await page.getByRole("option", { name: "Tehran", exact: true }).click();
}
async function essential(page: import("@playwright/test").Page) {
  await page
    .getByRole("combobox", { name: "Property city", exact: true })
    .click();
  await page.getByRole("option", { name: "Tehran", exact: true }).click();
  await page.locator("[name=building_size]").fill("90");
  await page
    .getByRole("combobox", { name: "Number of Bedrooms", exact: true })
    .click();
  await page.getByRole("option", { name: "2", exact: true }).click();
}
test("overview uses actual API statistics in a full-width analytics-first layout", async ({
  page,
  request,
}) => {
  const summary = await (await request.get("/api/v1/dashboard/summary")).json();
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Real Estate Market Overview",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    summary.count.toLocaleString("en"),
  );
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".chart-grid>.chart-panel")).toHaveCount(4);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(
    page.locator(".app-frame,.widget-layer,.insights-panel"),
  ).toHaveCount(0);
  await expect(page.locator(".primary-nav a")).toHaveCount(4);
  await city(page);
  const filtered = await (
    await request.get("/api/v1/dashboard/summary?city=tehran")
  ).json();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    String(filtered.count),
  );
  await page.getByRole("button", { name: "Reset Map", exact: true }).click();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    String(summary.count),
  );
});
test("charts remain in document flow with no drag or reposition controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Asking Price Distribution",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Move .* widget|Reset widget layout/ }),
  ).toHaveCount(0);
  const boxes = await page
    .locator(".map-panel,.chart-grid")
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect().toJSON()),
    );
  expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom);
});
test("historical properties paginate sort filter and expose accessible details", async ({
  page,
}) => {
  await page.goto("/properties");
  await expect(page.locator("tbody tr")).toHaveCount(5);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Sort properties", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Area: largest first", exact: true })
    .click();
  await page.locator(".detail-link").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Historical structured record",
  );
  await expect(page.getByRole("dialog")).toContainText("not an active listing");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await city(page);
  await page.getByText("More filters", { exact: true }).click();
  await page
    .getByLabel("Search listings", { exact: true })
    .fill("not-a-real-city");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(
    page.getByText("No matching historical sales", { exact: true }),
  ).toBeVisible();
});
test("essential-only estimation sends unknowns as null and shows separate real results", async ({
  page,
}) => {
  await page.goto("/predict");
  await page
    .getByRole("button", { name: "Estimate Property Value", exact: true })
    .click();
  await expect(page.locator(".main-content [role=alert]")).toContainText(
    "correct",
  );
  await essential(page);
  await page.locator("[name=asking_price]").fill("2000000000");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/valuation") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Estimate Property Value", exact: true })
    .click();
  const result = await response;
  expect(result.status()).toBe(200);
  const body = result.request().postDataJSON();
  expect(body.has_parking).toBeNull();
  expect(body.floor).toBeNull();
  expect(body.construction_year).toBeNull();
  const data = await result.json();
  await expect(
    page.getByRole("region", { name: "Estimation result", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".comparable-card")).toHaveCount(
    data.comparables.length,
  );
  if (data.prediction)
    await expect(page.locator(".prediction-number")).toBeVisible();
  await expect(
    page.getByText("Comparable Property Median", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".comparison-grid")).toContainText(
    "not a guarantee",
  );
  await page.getByText("How was this estimated?", { exact: true }).click();
  await expect(page.locator(".methodology")).toContainText(
    "not all prepared records",
  );
});
test("analytics range validation stays correctable and clear filters resets selection", async ({
  page,
  request,
}) => {
  await page.goto("/analytics");
  await city(page);
  await page.getByText("More filters", { exact: true }).click();
  const min = page.getByLabel("Building area (m²) minimum", { exact: true }),
    max = page.getByLabel("Building area (m²) maximum", { exact: true });
  await min.fill("180");
  await max.fill("140");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.locator(".main-content [role=alert]")).toContainText(
    "Minimum",
  );
  await min.fill("50");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("dashboard/summary") && r.url().includes("area_min=50"),
  );
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  expect((await response).status()).toBe(200);
  const expected = await (
    await request.get(
      "/api/v1/dashboard/summary?city=tehran&area_min=50&area_max=140",
    )
  ).json();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    String(expected.count),
  );
  await page
    .getByRole("button", { name: "Clear Filters", exact: true })
    .click();
  await expect(min).toHaveValue("");
});
test("model information stays secondary and uses actual artifact metrics", async ({
  page,
  request,
}) => {
  const metrics = await (await request.get("/api/v1/model/metrics")).json();
  await page.goto("/model");
  await expect(
    page.getByRole("heading", { name: "Model & Methodology", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".primary-nav a")).toHaveCount(4);
  if (metrics.scores) {
    await expect(page.locator(".metrics-table")).toContainText("Random Forest");
    await expect(
      page.locator(".kpi-card").first().locator("strong"),
    ).toHaveText(String(metrics.train_rows));
  }
  await expect(page.locator(".model-notice")).toContainText(
    "larger searchable archive is not its training population",
  );
});
test("mobile navigation Persian localization and RTL persist without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Price Estimator", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Switch to Persian", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "برآورد قیمت ملک", exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "شهر ملک", exact: true }).click();
  await page.getByRole("option", { name: "تهران", exact: true }).click();
  await page.locator("[name=building_size]").fill("۹۰");
  await page
    .getByRole("combobox", { name: "تعداد اتاق‌خواب", exact: true })
    .click();
  await page.getByRole("option", { name: "۲", exact: true }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/valuation") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "برآورد ارزش ملک", exact: true })
    .click();
  expect((await response).request().postDataJSON().building_size).toBe(90);
  await expect(
    page.getByRole("region", { name: "نتیجه برآورد", exact: true }),
  ).toBeVisible();
  await page.goto("/properties");
  await expect(
    page.getByRole("heading", { name: "جستجوی ملک", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Vazirmatn");
});
test("loading and failures never show fabricated aggregate cards", async ({
  page,
}) => {
  await page.route("**/api/v1/dashboard/summary**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { message: "Backend unavailable during test" },
      }),
    }),
  );
  await page.goto("/");
  await expect(page.locator(".main-content [role=alert]")).toContainText(
    "Backend unavailable during test",
  );
  await expect(page.locator(".kpi-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
});
