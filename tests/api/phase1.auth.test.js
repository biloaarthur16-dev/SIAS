import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, asAdmin, asOwen } from "./helpers.js";

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });

test("valid credentials return a token and public user (no password)", async () => {
  const r = await srv.api.post("/auth/login", { login: "admin", password: "admin123" });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.equal(r.body.user.role, "ASSUREUR");
  assert.equal(r.body.user.password, undefined, "password must never be returned");
});

test("missing fields -> 400", async () => {
  const r = await srv.api.post("/auth/login", { login: "admin" });
  assert.equal(r.status, 400);
});

test("/auth/me returns current user with a valid token", async () => {
  const token = await asAdmin(srv.api);
  const r = await srv.api.get("/auth/me", { token });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.login, "admin");
});

test("logout invalidates the token", async () => {
  const token = await asAdmin(srv.api);
  const out = await srv.api.post("/auth/logout", {}, { token });
  assert.equal(out.status, 200);
  const after = await srv.api.get("/auth/me", { token });
  assert.equal(after.status, 401);
});

test("role guard: medecin cannot create an assure (403)", async () => {
  const token = await asOwen(srv.api);
  const r = await srv.api.post("/assures", { nom: "X", prenom: "Y", email: "x@y.z" }, { token });
  assert.equal(r.status, 403);
});

test("4 wrong passwords lock the account (423)", async () => {
  const bad = { login: "nzoyem", password: "wrong" };
  let last;
  for (let i = 0; i < 4; i++) last = await srv.api.post("/auth/login", bad);
  assert.equal(last.status, 423, "4th failed attempt should lock");
  // even the correct password is now refused while locked
  const locked = await srv.api.post("/auth/login", { login: "nzoyem", password: "med123" });
  assert.equal(locked.status, 423);
});
