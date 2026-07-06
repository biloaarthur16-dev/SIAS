import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, asOwen, asNzoyem } from "./helpers.js";

let srv, owen, nzoyem;
before(async () => {
  srv = await startServer();
  owen = await asOwen(srv.api);     // generaliste MED-1
  nzoyem = await asNzoyem(srv.api); // specialiste MED-2
});
after(async () => { await srv.close(); });

// Philippe = ASS-1 (allergique à Pénicilline), médecin traitant Owen.
const PHILIPPE = "ASS-1";

test("médecin creates a consultation for a patient -> 201", async () => {
  const r = await srv.api.post("/consultations",
    { assureId: PHILIPPE, motif: "Toux" }, { token: owen });
  assert.equal(r.status, 201);
  assert.match(r.body.id, /^CONS-\d+$/);
  assert.equal(r.body.medecin, "Owen");
});

test("consultation for unknown assure -> 404", async () => {
  const r = await srv.api.post("/consultations",
    { assureId: "ASS-999", motif: "x" }, { token: owen });
  assert.equal(r.status, 404);
});

test("CU6: prescribe an allergen medication -> 400 contre-indication", async () => {
  const c = await srv.api.post("/consultations", { assureId: PHILIPPE }, { token: owen });
  const r = await srv.api.post("/prescriptions/medicament",
    { consultationId: c.body.id, nom: "Pénicilline", prix: 2000 }, { token: owen });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /allergique/i);
});

test("CU6: prescribe a safe medication -> 201", async () => {
  const c = await srv.api.post("/consultations", { assureId: PHILIPPE }, { token: owen });
  const r = await srv.api.post("/prescriptions/medicament",
    { consultationId: c.body.id, nom: "Paracétamol", prix: 1500 }, { token: owen });
  assert.equal(r.status, 201);
  assert.equal(r.body.type, "MEDICAMENT");
});

test("CU6: prescribing on someone else's consultation -> 403", async () => {
  const c = await srv.api.post("/consultations", { assureId: PHILIPPE }, { token: owen });
  const r = await srv.api.post("/prescriptions/medicament",
    { consultationId: c.body.id, nom: "Doliprane" }, { token: nzoyem }); // not owen's consult
  assert.equal(r.status, 403);
});

test("CU5: prescribe an orientation to a specialist -> 201 with specialite", async () => {
  const c = await srv.api.post("/consultations", { assureId: PHILIPPE }, { token: owen });
  const r = await srv.api.post("/prescriptions/consultation",
    { consultationId: c.body.id, specialisteId: "MED-2", motif: "Avis cardio" }, { token: owen });
  assert.equal(r.status, 201);
  assert.equal(r.body.type, "CONSULTATION");
  assert.ok(r.body.specialiteRecommandee, "specialite resolved from specialist");
});

test("CU5: orientation without target -> 400", async () => {
  const c = await srv.api.post("/consultations", { assureId: PHILIPPE }, { token: owen });
  const r = await srv.api.post("/prescriptions/consultation",
    { consultationId: c.body.id, motif: "rien" }, { token: owen });
  assert.equal(r.status, 400);
});
