import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

// Browser e2e run against a dedicated server instance on a throwaway DB,
// so they never touch the real data/db.json.
const PORT = 3100;
export const DB_FILE = path.join(os.tmpdir(), "sias-e2e-playwright.json");
export const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  globalSetup: "./tests/e2e/global-setup.js",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node server.js",
    env: { PORT: String(PORT), DB_FILE },
    url: `${BASE_URL}/`,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
