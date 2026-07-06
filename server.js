// ---------------------------------------------------------------------------
// Point d'entree du serveur (couche "Interface" cote serveur).
// Sert l'API REST + l'application web statique.
// ---------------------------------------------------------------------------
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import api from "./src/api.js";
import { ensureReady, resetDb } from "./src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API
app.use("/api", api);

// Front-end (fichiers statiques)
app.use(express.static(path.join(__dirname, "public")));

// Toute autre route renvoie l'application (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Gestion centralisee des erreurs (les routes appellent next(err)).
app.use((err, req, res, next) => {
  console.error("[api] erreur:", err.message);
  res.status(500).json({ error: "Erreur serveur." });
});

// Prepare la base (schema + seed) avant d'accepter des requetes.
// SEED_RESET=1 (tests) repart d'une base propre a chaque demarrage.
if (process.env.SEED_RESET === "1") await resetDb();
else await ensureReady();

const server = app.listen(PORT, () => {
  console.log("==================================================");
  console.log("  Gestion d'un organisme de securite sociale");
  console.log(`  Application disponible : http://localhost:${PORT}`);
  console.log("  Comptes de demo :");
  console.log("    - Assureur : admin  / admin123  (Saha)");
  console.log("    - Medecin  : owen   / med123    (Owen, generaliste)");
  console.log("    - Medecin  : nzoyem / med123    (Nzoyem, specialiste)");
  console.log("  (Astuce : Ctrl+C pour arreter proprement)");
  console.log("==================================================");
});

// Message clair si le port est deja pris (au lieu de la longue erreur EADDRINUSE)
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[ERREUR] Le port ${PORT} est deja utilise.`);
    console.error("Solutions :");
    console.error("  - Liberer le port :          npm run stop");
    console.error("  - Liberer puis relancer :    npm run restart");
    console.error("  - Utiliser un autre port :   $env:PORT=3001; npm start");
    process.exit(1);
  }
  throw err;
});

// Arret propre sur Ctrl+C (libere immediatement le port)
process.on("SIGINT", () => {
  console.log("\nArret du serveur...");
  server.close(() => process.exit(0));
});
