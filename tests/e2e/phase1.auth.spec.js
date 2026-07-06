import { test, expect } from "@playwright/test";
import { uiLogin } from "./helpers.js";

test("wrong password shows an inline error and stays on login", async ({ page }) => {
  await page.goto("/");
  await page.locator("#login-input").fill("admin");
  await page.locator("#password-input").fill("nope");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#login-error")).toBeVisible();
  await expect(page.locator("#app-view")).toBeHidden();
});

test("login then logout returns to the login screen", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  await page.locator("#logout-btn").click();
  await expect(page.locator("#login-view")).toBeVisible();
  await expect(page.locator("#app-view")).toBeHidden();
});

test("medecin sees a restricted nav (no Medecins/Remboursements menu)", async ({ page }) => {
  await uiLogin(page, "owen", "med123");
  await expect(page.locator('.nav-item[data-page="medecins"]')).toHaveCount(0);
  await expect(page.locator('.nav-item[data-page="remboursements"]')).toHaveCount(0);
  await expect(page.locator('.nav-item[data-page="prescriptions"]')).toBeVisible();
});
