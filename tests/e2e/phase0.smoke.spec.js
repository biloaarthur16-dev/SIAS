import { test, expect } from "@playwright/test";
import { uiLogin } from "./helpers.js";

test("login screen renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#login-view")).toBeVisible();
  await expect(page.locator("#login-form")).toBeVisible();
});

test("admin can log into the app shell", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  await expect(page.locator("#main-nav .nav-item")).not.toHaveCount(0);
  await expect(page.locator("#page-title")).toBeVisible();
});
