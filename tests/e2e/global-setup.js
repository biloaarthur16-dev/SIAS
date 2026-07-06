import fs from "node:fs";
import { DB_FILE } from "../../playwright.config.js";

// Wipe the throwaway DB before the browser suite so the server re-seeds fresh.
export default function globalSetup() {
  if (fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);
}
