import { test, expect } from "@playwright/test";
import { uiLogin } from "./helpers.js";

// Regression: the dashboard charts used to throw "fData.filter is not a function"
// because GET /feuilles was unreachable and returned a non-array. Guards the fix.
test("assureur dashboard renders both charts without console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await uiLogin(page, "admin", "admin123"); // lands on the dashboard
  await expect(page.locator("#medecinsChart")).toBeVisible();
  await expect(page.locator("#feuillesChart")).toBeVisible();
  await page.waitForTimeout(500); // let chart rendering settle

  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
});
