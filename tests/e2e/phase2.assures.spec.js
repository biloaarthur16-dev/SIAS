import { test, expect } from "@playwright/test";
import { uiLogin, gotoPage } from "./helpers.js";

test("CU2: inscrire an assure through the UI and see it in the table", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  await gotoPage(page, "assures");

  await page.locator('[data-act="add-assure"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();

  const stamp = Date.now();
  await page.locator('#modal-form [name="nom"]').fill("Testeur");
  await page.locator('#modal-form [name="prenom"]').fill("Playwright");
  await page.locator('#modal-form [name="email"]').fill(`pw${stamp}@mail.cm`);
  await page.locator('#modal-form button[type=submit]').click();

  await expect(page.locator("#modal-overlay")).toBeHidden();
  await expect(page.locator("table").getByText("Testeur")).toBeVisible();
});

test("CU3: assign a medecin traitant to an assure via the UI", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  await gotoPage(page, "assures");

  // Tanzi is seeded with no médecin traitant.
  const row = page.locator("table.data tbody tr", { hasText: "Tanzi" });
  await row.locator('[data-act="med-traitant"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();

  // index 1 = first médecin (Owen, généraliste)
  await page.locator('#modal-form [name="medecinId"]').selectOption({ index: 1 });
  await page.locator("#modal-form button[type=submit]").click();

  await expect(page.locator("#modal-overlay")).toBeHidden();
  // Tanzi's row now names its médecin traitant instead of the "Aucun" badge.
  await expect(page.locator("table.data tbody tr", { hasText: "Tanzi" }).locator(".badge-grey"))
    .toHaveCount(0);
  await expect(page.locator("table.data tbody tr", { hasText: "Tanzi" })).toContainText("Owen");
});
