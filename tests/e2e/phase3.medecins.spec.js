import { test, expect } from "@playwright/test";
import { uiLogin, gotoPage } from "./helpers.js";

test("CU10: inscrire a medecin through the UI", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  await gotoPage(page, "medecins");

  await page.locator('[data-act="add-medecin"]').click();
  await expect(page.locator("#modal-form")).toBeVisible();

  const stamp = Date.now();
  await page.locator('#modal-form [name="nom"]').fill("Docteur" + stamp);
  await page.locator('#modal-form [name="prenom"]').fill("Nouveau");
  await page.locator('#modal-form [name="type"]').selectOption("GENERALISTE");
  await page.locator("#modal-form button[type=submit]").click();

  await expect(page.locator("#modal-overlay")).toBeHidden();
  await expect(page.locator("table.data tbody")).toContainText("Docteur" + stamp);
});

// Create a throwaway médecin via the UI and return its display name.
// (We never deactivate the seeded Owen/Nzoyem — later phases log in as them.)
async function createDisposableMedecin(page, { login, password } = {}) {
  await gotoPage(page, "medecins");
  const name = "Jetable" + Date.now();
  await page.locator('[data-act="add-medecin"]').click();
  await page.locator('#modal-form [name="nom"]').fill(name);
  await page.locator('#modal-form [name="prenom"]').fill("Doc");
  await page.locator('#modal-form [name="type"]').selectOption("GENERALISTE");
  if (login) await page.locator('#modal-form [name="login"]').fill(login);
  if (password) await page.locator('#modal-form [name="password"]').fill(password);
  await page.locator("#modal-form button[type=submit]").click();
  await expect(page.locator("#modal-overlay")).toBeHidden();
  return name;
}

test("CU11: desactiver a medecin flips its badge and removes the action", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  const name = await createDisposableMedecin(page);

  const row = page.locator("table.data tbody tr", { hasText: name });
  await expect(row.locator(".badge-green")).toHaveText("Actif");

  page.on("dialog", (d) => d.accept()); // confirm()
  await row.locator('[data-act="desactiver-medecin"]').click();

  await expect(page.locator("table.data tbody tr", { hasText: name }).locator(".badge-grey"))
    .toHaveText("Désactivé");
  await expect(page.locator("table.data tbody tr", { hasText: name })
    .locator('[data-act="desactiver-medecin"]')).toHaveCount(0);
});

test("CU11bis: activer a deactivated medecin flips its badge back and restores login", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  page.on("dialog", (d) => d.accept());
  const login = "jetable" + Date.now();
  const name = await createDisposableMedecin(page, { login, password: "temp123" });

  const row = page.locator("table.data tbody tr", { hasText: name });
  await row.locator('[data-act="desactiver-medecin"]').click();
  await expect(row.locator(".badge-grey")).toHaveText("Désactivé");

  await row.locator('[data-act="activer-medecin"]').click();
  await expect(row.locator(".badge-green")).toHaveText("Actif");
  await expect(row.locator('[data-act="activer-medecin"]')).toHaveCount(0);
  await expect(row.locator('[data-act="desactiver-medecin"]')).toHaveCount(1);

  await page.locator("#logout-btn").click();
  await page.locator("#login-input").fill(login);
  await page.locator("#password-input").fill("temp123");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#app-view")).toBeVisible();
});

test("CU11 guard: a deactivated medecin can no longer log in via the UI", async ({ page }) => {
  await uiLogin(page, "admin", "admin123");
  page.on("dialog", (d) => d.accept());
  const login = "jetable" + Date.now();
  const name = await createDisposableMedecin(page, { login, password: "temp123" });

  await page.locator("table.data tbody tr", { hasText: name })
    .locator('[data-act="desactiver-medecin"]').click();
  await expect(page.locator("table.data tbody tr", { hasText: name }).locator(".badge-grey"))
    .toHaveText("Désactivé");
  await page.locator("#logout-btn").click();

  // The deactivated médecin is refused at login.
  await page.locator("#login-input").fill(login);
  await page.locator("#password-input").fill("temp123");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#login-error")).toBeVisible();
  await expect(page.locator("#app-view")).toBeHidden();
});
