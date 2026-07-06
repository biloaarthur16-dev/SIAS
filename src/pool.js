// ---------------------------------------------------------------------------
// Connexion PostgreSQL (couche "Driver"). Un seul pool partage pour toute l'app.
// La chaine de connexion vient de DATABASE_URL (voir .env, non versionne).
// ---------------------------------------------------------------------------
import pg from "pg";

// Charge .env si present (Node >= 20.6). En test, DATABASE_URL est deja injecte.
if (!process.env.DATABASE_URL) {
  try { process.loadEnvFile(); } catch { /* pas de .env : on garde le defaut */ }
}

const connectionString =
  process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/sias";

export const pool = new pg.Pool({ connectionString });

// Ne pas laisser une erreur de pool inactif crasher le process.
pool.on("error", (err) => {
  console.error("[pg] erreur inattendue du pool:", err.message);
});

/** Raccourci requete : query(text, params) -> rows. */
export async function query(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}
