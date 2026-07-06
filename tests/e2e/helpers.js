import { expect } from "@playwright/test";

// Log in through the real UI and wait for the app shell to appear.
export async function uiLogin(page, login, password) {
  await page.goto("/");
  await page.locator("#login-input").fill(login);
  await page.locator("#password-input").fill(password);
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#app-view")).toBeVisible();
}

// Click a sidebar nav entry by its data-page id.
export async function gotoPage(page, pageId) {
  await page.locator(`.nav-item[data-page="${pageId}"]`).click();
}
