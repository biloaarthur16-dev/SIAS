// ---------------------------------------------------------------------------
// Couche de persistance (joue le role du "Driver" + "Tables" de la base)
// Stockage simple dans un fichier JSON : aucune dependance native requise.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
// ponytail: DB_FILE env override lets e2e tests use a throwaway file instead of data/db.json
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, "db.json");

let data = null;

function ensureLoaded() {
  if (data) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } else {
    data = buildSeed();
    persist();
  }
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/** Renvoie une collection (tableau) par nom. */
export function table(name) {
  ensureLoaded();
  if (!data[name]) data[name] = [];
  return data[name];
}

/** Genere un identifiant lisible : prefixe + compteur (ex: ASS-1, MED-2). */
export function nextId(prefix) {
  ensureLoaded();
  if (!data.counters) data.counters = {};
  data.counters[prefix] = (data.counters[prefix] || 0) + 1;
  return `${prefix}-${data.counters[prefix]}`;
}

/** Recupere le dictionnaire des sessions actives. */
export function getSessions() {
  ensureLoaded();
  if (!data.sessions) data.sessions = {};
  return data.sessions;
}

/** Sauvegarde l'etat courant sur disque. */
export function save() {
  ensureLoaded();
  persist();
}

/** Recherche un element par id dans une collection. */
export function findById(name, id) {
  return table(name).find((row) => row.id === id) || null;
}

/** Reinitialise completement la base (utilise par /api/admin/reset). */
export function resetDb() {
  data = buildSeed();
  persist();
  return data;
}
