// Shared harness for API-level e2e tests.
// Boots the REAL server.js as a child process on its own port, against a
// throwaway DB file, and drives it over real HTTP. Full stack, zero mocks.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

// Test database (isolated from the app DB). SEED_RESET=1 gives each server boot
// a clean, freshly-seeded schema. API test files run serially
// (--test-concurrency=1) so they never share this DB at the same time.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/sias_test";

let portCursor = 3200 + Math.floor(Math.random() * 300);

/** Boot a server instance against a freshly-reset test database. */
export async function startServer() {
  const port = portCursor++;
  const child = spawn("node", ["server.js"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DATABASE_URL: TEST_DB_URL, SEED_RESET: "1" },
    stdio: ["ignore", "ignore", "inherit"],
  });

  const baseURL = `http://localhost:${port}`;
  await waitReady(`${baseURL}/api/specialites`);

  const close = () =>
    new Promise((resolve) => {
      child.on("exit", () => resolve());
      child.kill("SIGKILL");
    });

  return { baseURL, close, api: makeApi(baseURL) };
}

async function waitReady(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      // Any HTTP response (even 401) means the server is up.
      await fetch(url);
      return;
    } catch {
      await sleep(50);
    }
  }
  throw new Error("Server did not start in time");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tiny fetch wrapper: { status, body } and optional bearer token. */
function makeApi(baseURL) {
  async function call(method, pathname, { token, body } = {}) {
    const res = await fetch(baseURL + "/api" + pathname, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let parsed = null;
    const text = await res.text();
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed };
  }
  return {
    get: (p, o) => call("GET", p, o),
    post: (p, body, o = {}) => call("POST", p, { ...o, body }),
    put: (p, body, o = {}) => call("PUT", p, { ...o, body }),
    del: (p, o) => call("DELETE", p, o),
  };
}

/** Log in and return the bearer token (throws on failure). */
export async function login(api, loginName, password) {
  const r = await api.post("/auth/login", { login: loginName, password });
  if (r.status !== 200) throw new Error(`login failed for ${loginName}: ${JSON.stringify(r.body)}`);
  return r.body.token;
}

export const asAdmin = (api) => login(api, "admin", "admin123");
export const asOwen = (api) => login(api, "owen", "med123"); // generaliste
export const asNzoyem = (api) => login(api, "nzoyem", "med123"); // specialiste
