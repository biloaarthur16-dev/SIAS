// ---------------------------------------------------------------------------
// Couche d'acces aux donnees (repository). Traduit les lignes SQL (snake_case)
// vers les objets JS (camelCase) attendus par les routes, et inversement.
// Les historiques d'etats (tables filles) sont rattaches/persistes ici.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool, query } from "./pool.js";
import { seedRows } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Colonnes autorisees par table (cles camelCase). Filtre les cles enrichies
// (medecinTraitant, assure, rembourse...) et les tableaux (historiqueEtats).
const COLS = {
  assureurs: ["id", "role", "nom", "prenom", "email", "tel", "login", "password", "etat"],
  medecins: ["id", "role", "type", "specialite", "nom", "prenom", "age", "email", "tel", "login", "password", "etat"],
  assures: ["id", "role", "nom", "prenom", "age", "email", "tel", "profession", "groupeSanguin", "allergies", "medecinTraitantId", "isMedecin", "medecinId"],
  specialites: ["id", "nom"],
  consultations: ["id", "assureId", "medecinId", "date", "etat", "motif"],
  feuilles: ["id", "assureId", "medecinId", "consultationId", "montantSoins", "montantTotal", "contenu", "etat", "dateCreation"],
  prescriptions: ["id", "type", "consultationId", "nom", "prix", "specialiteRecommandee", "specialisteId", "motif", "date"],
  remboursements: ["id", "feuilleId", "assureId", "medecinType", "taux", "montantSoins", "montant", "modePaiement", "dateHeure", "etat"],
};

const toSnake = (s) => s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const toCamel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const rowToObj = (row) =>
  row == null ? null : Object.fromEntries(Object.entries(row).map(([k, v]) => [toCamel(k), v]));

// --------------------------- Initialisation --------------------------------

export async function initSchema() {
  const ddl = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(ddl);
}

/** Vide toutes les tables et recharge les donnees de demonstration. */
export async function resetDb() {
  await initSchema();
  const tables = [
    "remboursement_etats", "remboursements", "feuille_etats", "feuilles",
    "prescriptions", "consultations", "assures", "medecins", "assureurs",
    "specialites", "counters",
  ];
  await pool.query(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  await loadSeed();
}

/** Cree le schema puis charge le seed uniquement si la base est vide. */
export async function ensureReady() {
  await initSchema();
  const [{ count }] = await query("SELECT count(*)::int AS count FROM assureurs");
  if (count === 0) await loadSeed();
}

async function loadSeed() {
  const data = seedRows();
  for (const [prefix, n] of Object.entries(data.counters)) {
    await query("INSERT INTO counters(prefix, n) VALUES ($1, $2) ON CONFLICT(prefix) DO UPDATE SET n = EXCLUDED.n", [prefix, n]);
  }
  for (const s of data.specialites) await insert("specialites", s);
  for (const a of data.assureurs) await insert("assureurs", a);
  for (const m of data.medecins) await insert("medecins", m);
  for (const a of data.assures) await insert("assures", a);
  for (const c of data.consultations) await insert("consultations", c);
}

// --------------------------- Identifiants ----------------------------------

/** Identifiant lisible atomique : prefixe + compteur (ex: ASS-1). */
export async function nextId(prefix) {
  const rows = await query(
    `INSERT INTO counters(prefix, n) VALUES ($1, 1)
     ON CONFLICT(prefix) DO UPDATE SET n = counters.n + 1 RETURNING n`,
    [prefix]
  );
  return `${prefix}-${rows[0].n}`;
}

// --------------------------- CRUD generique --------------------------------

function pick(table, obj) {
  const allowed = COLS[table];
  const entries = allowed
    .filter((k) => obj[k] !== undefined)
    .map((k) => [toSnake(k), obj[k]]);
  return Object.fromEntries(entries);
}

export async function all(table) {
  const rows = await query(`SELECT * FROM ${table}`);
  return rows.map(rowToObj);
}

export async function get(table, id) {
  const rows = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
  return rowToObj(rows[0]);
}

export async function insert(table, obj) {
  const data = pick(table, obj);
  const keys = Object.keys(data);
  const cols = keys.join(", ");
  const params = keys.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await query(
    `INSERT INTO ${table} (${cols}) VALUES (${params}) RETURNING *`,
    keys.map((k) => data[k])
  );
  return rowToObj(rows[0]);
}

export async function update(table, id, patch) {
  const data = pick(table, patch);
  const keys = Object.keys(data).filter((k) => k !== "id");
  if (keys.length === 0) return get(table, id);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const rows = await query(
    `UPDATE ${table} SET ${sets} WHERE id = $1 RETURNING *`,
    [id, ...keys.map((k) => data[k])]
  );
  return rowToObj(rows[0]);
}

export async function remove(table, id) {
  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
}

// -------------------- Historiques d'etats (tables filles) ------------------

export async function addFeuilleEtat(feuilleId, etat, date) {
  await query("INSERT INTO feuille_etats (feuille_id, etat, date) VALUES ($1, $2, $3)", [feuilleId, etat, date]);
}

export async function feuilleEtats(feuilleId) {
  return query("SELECT etat, date FROM feuille_etats WHERE feuille_id = $1 ORDER BY id", [feuilleId]);
}

export async function addRemboursementEtat(rembId, etat, date, detail) {
  await query("INSERT INTO remboursement_etats (remboursement_id, etat, date, detail) VALUES ($1, $2, $3, $4)", [rembId, etat, date, detail || null]);
}

export async function remboursementEtats(rembId) {
  const rows = await query("SELECT etat, date, detail FROM remboursement_etats WHERE remboursement_id = $1 ORDER BY id", [rembId]);
  // Ne pas exposer detail:null pour rester proche de l'ancienne forme.
  return rows.map((r) => (r.detail == null ? { etat: r.etat, date: r.date } : r));
}
