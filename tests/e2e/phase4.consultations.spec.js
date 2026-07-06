import { test, expect } from "@playwright/test";
import { uiLogin, gotoPage } from "./helpers.js";

test("médecin creates a consultation through the UI", async ({ page }) => {
  await uiLogin(page, "owen", "med123");
  await gotoPage(page, "consultations");

  await page.locator('[data-act="add-consultation"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();
  await page.locator('#modal-form [name="assureId"]').selectOption({ index: 1 });
  await page.locator('#modal-form [name="motif"]').fill("Contrôle e2e");
  await page.locator("#modal-form button[type=submit]").click();

  await expect(page.locator("#modal-overlay")).toBeHidden();
  await expect(page.locator("table.data tbody")).toContainText("Contrôle e2e");
});

test("CU6: allergen prescription is blocked with a contre-indication error", async ({ page }) => {
  await uiLogin(page, "owen", "med123");
  await gotoPage(page, "prescriptions");

  await page.locator('[data-act="presc-medicament"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();
  // Owen's only patient with a consultation is Philippe (allergique Pénicilline).
  await page.locator('#modal-form [name="consultationId"]').selectOption({ index: 1 });
  await page.locator('#modal-form [name="nom"]').fill("Pénicilline");
  await page.locator("#modal-form button[type=submit]").click();

  // The modal stays open and shows the error (submission rejected).
  await expect(page.locator("#modal-form-error")).toBeVisible();
  await expect(page.locator("#modal-form-error")).toContainText(/allergique/i);
});

test("CU6: a safe medication is prescribed and listed", async ({ page }) => {
  await uiLogin(page, "owen", "med123");
  await gotoPage(page, "prescriptions");

  await page.locator('[data-act="presc-medicament"]').click();
  await page.locator('#modal-form [name="consultationId"]').selectOption({ index: 1 });
  await page.locator('#modal-form [name="nom"]').fill("Paracétamol");
  await page.locator("#modal-form button[type=submit]").click();

  await expect(page.locator("#modal-overlay")).toBeHidden();
  await expect(page.locator("table.data tbody")).toContainText("Paracétamol");
});
