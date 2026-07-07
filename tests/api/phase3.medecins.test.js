import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, asAdmin, login } from "./helpers.js";

let srv, token;
before(async () => {
  srv = await startServer();
  token = await asAdmin(srv.api);
});
after(async () => { await srv.close(); });

async function createMedecin(overrides = {}) {
  const suffix = Math.floor(Math.random() * 1e6);
  const body = {
    nom: "Med" + suffix, prenom: "Jean", type: "GENERALISTE",
    login: "med" + suffix, password: "pass123", ...overrides,
  };
  const r = await srv.api.post("/medecins", body, { token });
  return { r, login: body.login, password: body.password };
}

test("CU10: inscrire un medecin -> 201, login auto-created, can authenticate", async () => {
  const { r, login: lg, password } = await createMedecin();
  assert.equal(r.status, 201);
  assert.match(r.body.id, /^MED-\d+$/);
  const tok = await login(srv.api, lg, password);
  assert.ok(tok);
});

test("CU10: specialiste requires a specialite -> 400", async () => {
  const r = await srv.api.post("/medecins",
    { nom: "Spec", prenom: "A", type: "SPECIALISTE" }, { token });
  assert.equal(r.status, 400);
});

test("CU10: duplicate login -> 409", async () => {
  const { login: lg } = await createMedecin();
  const dup = await srv.api.post("/medecins",
    { nom: "Other", prenom: "B", type: "GENERALISTE", login: lg }, { token });
  assert.equal(dup.status, 409);
});

test("CU11: desactiver flips etat to Désactivé", async () => {
  const { r } = await createMedecin();
  const id = r.body.id;
  const d = await srv.api.put(`/medecins/${id}/desactiver`, {}, { token });
  assert.equal(d.status, 200);
  assert.equal(d.body.etat, "Désactivé");
});

test("CU11 alt: desactiver an already-deactivated medecin -> 409", async () => {
  const { r } = await createMedecin();
  const id = r.body.id;
  await srv.api.put(`/medecins/${id}/desactiver`, {}, { token });
  const again = await srv.api.put(`/medecins/${id}/desactiver`, {}, { token });
  assert.equal(again.status, 409);
});

test("CU11 alt: desactiver an unknown medecin -> 404", async () => {
  const r = await srv.api.put("/medecins/MED-inexistant/desactiver", {}, { token });
  assert.equal(r.status, 404);
});

test("CU11 guard: a deactivated medecin can no longer log in -> 403", async () => {
  const { r, login: lg, password } = await createMedecin();
  await srv.api.put(`/medecins/${r.body.id}/desactiver`, {}, { token });
  const attempt = await srv.api.post("/auth/login", { login: lg, password });
  assert.equal(attempt.status, 403);
});

test("CU11 guard: deactivating mid-session blocks the medecin's active token -> 403", async () => {
  const { r, login: lg, password } = await createMedecin();
  const medToken = await login(srv.api, lg, password); // logged in while active
  const ok = await srv.api.get("/consultations", { token: medToken });
  assert.equal(ok.status, 200);
  await srv.api.put(`/medecins/${r.body.id}/desactiver`, {}, { token });
  const blocked = await srv.api.get("/consultations", { token: medToken });
  assert.equal(blocked.status, 403);
});

test("CU11bis: activer flips etat back to Actif and login works again", async () => {
  const { r, login: lg, password } = await createMedecin();
  const id = r.body.id;
  await srv.api.put(`/medecins/${id}/desactiver`, {}, { token });

  const a = await srv.api.put(`/medecins/${id}/activer`, {}, { token });
  assert.equal(a.status, 200);
  assert.equal(a.body.etat, "Actif");

  const attempt = await srv.api.post("/auth/login", { login: lg, password });
  assert.equal(attempt.status, 200);
});

test("CU11bis alt: activer an already-active medecin -> 409", async () => {
  const { r } = await createMedecin();
  const again = await srv.api.put(`/medecins/${r.body.id}/activer`, {}, { token });
  assert.equal(again.status, 409);
});

test("CU11bis alt: activer an unknown medecin -> 404", async () => {
  const r = await srv.api.put("/medecins/MED-inexistant/activer", {}, { token });
  assert.equal(r.status, 404);
});
