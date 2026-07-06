import { test, expect } from "@playwright/test";
import { uiLogin, gotoPage } from "./helpers.js";

test("CU4: médecin creates a feuille de maladie (Remplie partiellement)", async ({ page }) => {
  await uiLogin(page, "owen", "med123");
  await gotoPage(page, "feuilles");

  await page.locator('[data-act="add-feuille"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();
  await page.locator('#modal-form [name="assureId"]').selectOption({ index: 1 });
  await page.locator('#modal-form [name="montantSoins"]').selectOption("15000");
  await page.locator('#modal-form [name="contenu"]').fill("Diagnostic e2e");
  await page.locator("#modal-form button[type=submit]").click();

  await expect(page.locator("#modal-overlay")).toBeHidden();
  await expect(page.locator("table.data tbody")).toContainText("Remplie partiellement");
});

test("CU9: assureur complète the feuille -> Enregistrée", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  await gotoPage(page, "feuilles");

  // The feuille created above is REMPLIE_PARTIELLEMENT -> has a "Completer" button.
  const row = page.locator("table.data tbody tr", { hasText: "Remplie partiellement" }).first();
  await row.locator('[data-act="completer-feuille"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();
  await page.locator("#modal-form button[type=submit]").click();

  await expect(page.locator("#modal-overlay")).toBeHidden();
  await expect(page.locator("table.data tbody")).toContainText("Enregistrée");
});
