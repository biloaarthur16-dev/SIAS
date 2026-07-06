import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, asAdmin } from "./helpers.js";

let srv;
before(async () => { srv = await startServer(); });
after(async () => { await srv.close(); });

test("server boots and serves the SPA", async () => {
  const res = await fetch(srv.baseURL + "/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<div id="app-view"|login-view|<!doctype html>/i);
});

test("protected route rejects anonymous access (401)", async () => {
  const r = await srv.api.get("/stats");
  assert.equal(r.status, 401);
});

test("seeded assureur admin/admin123 can log in", async () => {
  const token = await asAdmin(srv.api);
  assert.ok(token, "expected a token");
  const stats = await srv.api.get("/stats", { token });
  assert.equal(stats.status, 200);
  assert.equal(typeof stats.body.assures, "number");
});
