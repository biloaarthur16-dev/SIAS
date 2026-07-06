import { test, expect } from "@playwright/test";
import { uiLogin, gotoPage } from "./helpers.js";

// Build a registered feuille through the UI so a remboursement is possible.
async function makeRegisteredFeuille(page) {
  await uiLogin(page, "owen", "med123");
  await gotoPage(page, "feuilles");
  await page.locator('[data-act="add-feuille"]').click();
  await page.locator('#modal-form [name="assureId"]').selectOption({ index: 1 });
  await page.locator('#modal-form [name="montantSoins"]').selectOption("15000");
  await page.locator("#modal-form button[type=submit]").click();
  await expect(page.locator("#modal-overlay")).toBeHidden();
  await page.locator("#logout-btn").click();

  await uiLogin(page, "admin", "admin123");
  await gotoPage(page, "feuilles");
  const row = page.locator("table.data tbody tr", { hasText: "Remplie partiellement" }).first();
  await row.locator('[data-act="completer-feuille"]').click();
  await page.locator("#modal-form button[type=submit]").click();
  await expect(page.locator("#modal-overlay")).toBeHidden();
}

test("CU7 + CU8: effectuer un remboursement then open its facture", async ({ page }) => {
  await makeRegisteredFeuille(page);

  // Rembourser the just-registered feuille (généraliste -> 100%).
  await gotoPage(page, "feuilles");
  const row = page.locator("table.data tbody tr", { hasText: "Enregistrée" }).first();
  await row.locator('[data-act="rembourser"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();
  await page.locator('#modal-form [name="modePaiement"]').selectOption("VIREMENT");
  await page.locator("#modal-form button[type=submit]").click();
  await expect(page.locator("#modal-overlay")).toBeHidden();

  // The remboursement now appears with its facture button.
  await gotoPage(page, "remboursements");
  await expect(page.locator("table.data tbody")).toContainText("100");
  await page.locator('[data-act="facture"]').first().click();

  // Facture modal shows the printable justificatif with a print button.
  await expect(page.locator("#print-area")).toBeVisible();
  await expect(page.locator("#print-area")).toContainText("Justificatif de remboursement");
  await expect(page.locator('button', { hasText: "Imprimer" })).toBeVisible();
});
