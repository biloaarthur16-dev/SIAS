import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, asAdmin } from "./helpers.js";

let srv, token;
before(async () => {
  srv = await startServer();
  token = await asAdmin(srv.api);
});
after(async () => { await srv.close(); });

test("CU2: inscrire un assure -> 201 with generated id", async () => {
  const r = await srv.api.post("/assures",
    { nom: "Kamga", prenom: "Luc", email: "luc.kamga@mail.cm" }, { token });
  assert.equal(r.status, 201);
  assert.match(r.body.id, /^ASS-\d+$/);
  assert.equal(r.body.role, "ASSURE");
});

test("CU2: missing required fields -> 400", async () => {
  const r = await srv.api.post("/assures", { nom: "X" }, { token });
  assert.equal(r.status, 400);
});

test("CU2: duplicate email -> 409", async () => {
  const body = { nom: "Doe", prenom: "Jane", email: "dup@mail.cm" };
  const first = await srv.api.post("/assures", body, { token });
  assert.equal(first.status, 201);
  const second = await srv.api.post("/assures", body, { token });
  assert.equal(second.status, 409);
});

test("CU3: assign medecin traitant, then re-assign flags miseAJour", async () => {
  const created = await srv.api.post("/assures",
    { nom: "Ngo", prenom: "Aline", email: "aline.ngo@mail.cm" }, { token });
  const id = created.body.id;

  const meds = await srv.api.get("/medecins", { token });
  const generaliste = meds.body.find((m) => m.type === "GENERALISTE");
  const autreGeneraliste = await srv.api.post("/medecins",
    { nom: "Bis", prenom: "Doc", type: "GENERALISTE" }, { token });

  const a1 = await srv.api.put(`/assures/${id}/medecin-traitant`, { medecinId: generaliste.id }, { token });
  assert.equal(a1.status, 200);
  assert.equal(a1.body.miseAJour, false, "first assignment is not an update");
  assert.ok(a1.body.medecinTraitant, "enriched label present");

  const a2 = await srv.api.put(`/assures/${id}/medecin-traitant`,
    { medecinId: autreGeneraliste.body.id }, { token });
  assert.equal(a2.status, 200);
  assert.equal(a2.body.miseAJour, true, "re-assignment flagged as update");
});

test("CU3: assigning a specialiste as medecin traitant -> 400", async () => {
  const created = await srv.api.post("/assures",
    { nom: "Eyenga", prenom: "Sara", email: "sara.eyenga@mail.cm" }, { token });
  const meds = await srv.api.get("/medecins", { token });
  const specialiste = meds.body.find((m) => m.type === "SPECIALISTE");

  const r = await srv.api.put(`/assures/${created.body.id}/medecin-traitant`,
    { medecinId: specialiste.id }, { token });
  assert.equal(r.status, 400);
});

test("CU3: unknown medecin -> 404", async () => {
  const created = await srv.api.post("/assures",
    { nom: "Fon", prenom: "Ben", email: "ben.fon@mail.cm" }, { token });
  const r = await srv.api.put(`/assures/${created.body.id}/medecin-traitant`,
    { medecinId: "MED-999" }, { token });
  assert.equal(r.status, 404);
});
