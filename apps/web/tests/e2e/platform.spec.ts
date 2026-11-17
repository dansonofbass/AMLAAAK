import { test, expect } from "@playwright/test";
test("city dropdown is readable without hover and supports search and keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".kpi-card").first()).toBeVisible();
  await page
    .getByRole("combobox", { name: "Selected city", exact: true })
    .click();
  await page.mouse.move(0, 0);
  expect(
    await page
      .locator("body")
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Roboto");
  const option = page.getByRole("option", { name: "Tehran", exact: true });
  await expect(option).toBeVisible();
  expect(await option.evaluate((el) => getComputedStyle(el).color)).not.toBe(
    "rgb(24, 35, 53)",
  );
  expect(
    await page
      .locator(".picker-popup")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(24, 35, 53)");
  await page.screenshot({
    path: "test-results/dropdown-open-desktop.png",
    fullPage: false,
  });
  await page.getByRole("textbox", { name: "Search selected city" }).fill("teh");
  await page.keyboard.press("Enter");
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "5",
  );
});
test("province geometry selects a city and synchronizes backend aggregates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle map focus" }).click();
  const province = page.locator('path[data-province="Tehran"]').first();
  await expect(province).toBeVisible();
  await province.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "5",
  );
  await expect(page.locator(".province-selected")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/map-selected-province.png",
    fullPage: true,
  });
});
test("offline valuation returns actual fixture comparables with separate model estimate", async ({
  page,
}) => {
  await page.goto("/predict");
  await page.getByRole("button", { name: "Estimate asking price" }).click();
  await expect(page.locator(".comparable-card")).toHaveCount(5);
  await expect(
    page.getByText("RETRIEVED COMPARABLE MEDIAN", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Illustrative fixture record").first(),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/valuation-desktop.png",
    fullPage: true,
  });
});
test("mobile city dropdown and valuation have no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "City filter", exact: true })
    .click();
  await page.mouse.move(0, 0);
  await expect(
    page.getByRole("option", { name: "Tehran", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dropdown-open-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await page.goto("/predict");
  await page.getByRole("button", { name: "Estimate asking price" }).click();
  await expect(page.locator(".comparable-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/valuation-mobile.png",
    fullPage: true,
  });
});
