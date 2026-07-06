import { defineConfig } from "@playwright/test";

// Browser e2e run against a dedicated server on the Postgres TEST database.
// SEED_RESET=1 gives a clean, freshly-seeded schema at server boot.
const PORT = 3100;
export const BASE_URL = `http://localhost:${PORT}`;
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/sias_test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node server.js",
    env: { PORT: String(PORT), DATABASE_URL: TEST_DB_URL, SEED_RESET: "1" },
    url: `${BASE_URL}/`,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
