import { test, expect } from "@playwright/test";
test("exact palette display fonts and searchable keyboard dropdown", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".kpi-card").first()).toBeVisible();
  const palette = await page.locator("html").evaluate((el) => {
    const s = getComputedStyle(el);
    return ["--background", "--surface", "--accent", "--text"].map((k) =>
      s.getPropertyValue(k).trim(),
    );
  });
  expect(palette).toEqual(["#0a0f14", "#111922", "#4d9bd6", "#e8edf2"]);
  expect(
    await page.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily),
  ).toContain("Orbitron");
  await page
    .getByRole("combobox", { name: "Selected city", exact: true })
    .click();
  await page.mouse.move(0, 0);
  expect(
    await page
      .locator(".picker-popup")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(21, 30, 39)");
  await page
    .getByRole("textbox", { name: "Search selected city", exact: true })
    .fill("teh");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "5",
  );
});
test("map supports keyboard city selection reset and retained attribution", async ({
  page,
}) => {
  await page.goto("/");
  const marker = page.locator('[data-city="tehran"]');
  await expect(marker).toBeVisible();
  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "5",
  );
  await page.getByRole("button", { name: "Reset Map", exact: true }).click();
  await expect(page.locator(".kpi-card").first().locator("strong")).toHaveText(
    "8",
  );
  await expect(page.locator(".leaflet-control-attribution")).toContainText(
    "geoBoundaries",
  );
  expect(await page.locator(".province-boundary").count()).toBeGreaterThan(25);
});
test("explicit No remains false while advanced Unknown remains null", async ({
  page,
}) => {
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
  await page.getByText("Additional Property Details", { exact: true }).click();
  await page.getByRole("combobox", { name: "Parking", exact: true }).click();
  await page.getByRole("option", { name: "No", exact: true }).click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/valuation") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Estimate Property Value", exact: true })
    .click();
  const body = (await response).request().postDataJSON();
  expect(body.has_parking).toBe(false);
  expect(body.has_elevator).toBeNull();
});
test("tablet layout reduced motion and mobile drawer focus are accessible", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");
  await expect(page.locator(".kpi-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const trigger = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});
