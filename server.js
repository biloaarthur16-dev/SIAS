// ---------------------------------------------------------------------------
// Point d'entree du serveur (couche "Interface" cote serveur).
// Sert l'API REST + l'application web statique.
// ---------------------------------------------------------------------------
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import api from "./src/api.js";

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
