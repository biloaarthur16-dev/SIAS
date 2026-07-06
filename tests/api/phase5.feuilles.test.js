import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, asAdmin, asOwen } from "./helpers.js";

let srv, admin, owen;
before(async () => {
  srv = await startServer();
  admin = await asAdmin(srv.api);
  owen = await asOwen(srv.api);
});
after(async () => { await srv.close(); });

const PHILIPPE = "ASS-1";

async function newFeuille(montant = 15000) {
  const r = await srv.api.post("/feuilles",
    { assureId: PHILIPPE, montantSoins: montant, contenu: "Grippe" }, { token: owen });
  return r;
}

test("CU4: médecin creates a feuille -> 201, état REMPLIE_PARTIELLEMENT", async () => {
  const r = await newFeuille();
  assert.equal(r.status, 201);
  assert.match(r.body.id, /^FM-\d+$/);
  assert.equal(r.body.etat, "REMPLIE_PARTIELLEMENT");
});

test("CU4: montant <= 0 -> 400", async () => {
  const r = await srv.api.post("/feuilles",
    { assureId: PHILIPPE, montantSoins: 0 }, { token: owen });
  assert.equal(r.status, 400);
});

test("CU4: assureur cannot create a feuille -> 403", async () => {
  const r = await srv.api.post("/feuilles",
    { assureId: PHILIPPE, montantSoins: 15000 }, { token: admin });
  assert.equal(r.status, 403);
});

test("CU9: assureur complète a feuille -> ENREGISTREE with state history", async () => {
  const created = await newFeuille();
  const r = await srv.api.put(`/feuilles/${created.body.id}/completer`,
    { montantTotal: 20000, contenu: "Complété" }, { token: admin });
  assert.equal(r.status, 200);
  assert.equal(r.body.etat, "ENREGISTREE");
  const etats = r.body.historiqueEtats.map((h) => h.etat);
  assert.ok(etats.includes("ENREGISTREE"));
});

test("CU9: completing an already-registered feuille -> 409", async () => {
  const created = await newFeuille();
  await srv.api.put(`/feuilles/${created.body.id}/completer`, {}, { token: admin });
  const again = await srv.api.put(`/feuilles/${created.body.id}/completer`, {}, { token: admin });
  assert.equal(again.status, 409);
});

test("CU9: médecin cannot complète a feuille -> 403", async () => {
  const created = await newFeuille();
  const r = await srv.api.put(`/feuilles/${created.body.id}/completer`, {}, { token: owen });
  assert.equal(r.status, 403);
});
