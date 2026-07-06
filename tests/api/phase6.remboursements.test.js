import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, asAdmin, asOwen, asNzoyem } from "./helpers.js";

let srv, admin, owen, nzoyem;
before(async () => {
  srv = await startServer();
  admin = await asAdmin(srv.api);
  owen = await asOwen(srv.api);     // generaliste MED-1
  nzoyem = await asNzoyem(srv.api); // specialiste MED-2 (Cardiologie)
});
after(async () => { await srv.close(); });

const PHILIPPE = "ASS-1";
const TANZI = "ASS-2";

// Create a feuille (by médecin) and register it (by assureur). Returns feuille id.
async function registeredFeuille(medToken, assureId, montant = 15000) {
  const f = await srv.api.post("/feuilles",
    { assureId, montantSoins: montant, contenu: "soins" }, { token: medToken });
  await srv.api.put(`/feuilles/${f.body.id}/completer`, {}, { token: admin });
  return f.body.id;
}

test("CU7: généraliste feuille reimbursed at 100%", async () => {
  const id = await registeredFeuille(owen, PHILIPPE, 15000);
  const r = await srv.api.post("/remboursements", { feuilleId: id, modePaiement: "ESPECES" }, { token: admin });
  assert.equal(r.status, 201);
  assert.equal(r.body.taux, 100);
  assert.equal(r.body.montant, 15000);
  assert.equal(r.body.modePaiement, "ESPECES");
});

test("CU7: spécialiste WITHOUT orientation reimbursed at 30%", async () => {
  const id = await registeredFeuille(nzoyem, TANZI, 20000);
  const r = await srv.api.post("/remboursements", { feuilleId: id, modePaiement: "VIREMENT" }, { token: admin });
  assert.equal(r.status, 201);
  assert.equal(r.body.taux, 30);
  assert.equal(r.body.montant, 6000);
});

test("CU7: spécialiste WITH orientation reimbursed at 80%", async () => {
  // Généraliste consults Philippe and orients him to the specialist Nzoyem.
  const c = await srv.api.post("/consultations", { assureId: PHILIPPE }, { token: owen });
  await srv.api.post("/prescriptions/consultation",
    { consultationId: c.body.id, specialisteId: "MED-2", motif: "cardio" }, { token: owen });
  // Now the specialist issues a feuille for Philippe.
  const id = await registeredFeuille(nzoyem, PHILIPPE, 25000);
  const r = await srv.api.post("/remboursements", { feuilleId: id, modePaiement: "VIREMENT" }, { token: admin });
  assert.equal(r.status, 201);
  assert.equal(r.body.taux, 80);
  assert.equal(r.body.montant, 20000);
});

test("CU7: remboursement on a non-registered feuille -> 400", async () => {
  const f = await srv.api.post("/feuilles",
    { assureId: PHILIPPE, montantSoins: 15000 }, { token: owen }); // not completed
  const r = await srv.api.post("/remboursements", { feuilleId: f.body.id }, { token: admin });
  assert.equal(r.status, 400);
});

test("CU7: double remboursement on the same feuille -> 409", async () => {
  const id = await registeredFeuille(owen, PHILIPPE, 15000);
  const first = await srv.api.post("/remboursements", { feuilleId: id }, { token: admin });
  assert.equal(first.status, 201);
  const second = await srv.api.post("/remboursements", { feuilleId: id }, { token: admin });
  assert.equal(second.status, 409);
});

test("CU8: facture reflects the remboursement", async () => {
  const id = await registeredFeuille(owen, PHILIPPE, 15000);
  const remb = await srv.api.post("/remboursements", { feuilleId: id, modePaiement: "VIREMENT" }, { token: admin });
  const fac = await srv.api.get(`/remboursements/${remb.body.id}/facture`, { token: admin });
  assert.equal(fac.status, 200);
  assert.equal(fac.body.montantRembourse, 15000);
  assert.equal(fac.body.taux, 100);
  assert.equal(fac.body.modePaiement, "VIREMENT");
});
