import express from "express";
import crypto from "node:crypto";
import { save, findById, getSessions } from "../db.js";
import { hashPwd, findUserByLogin, publicUser, auth } from "../utils.js";

const router = express.Router();

const loginAttempts = new Map(); // login -> { count, lockedUntil }
const MAX_ATTEMPTS = 4;
const LOCK_MS = 30 * 60 * 1000;

router.post("/login", (req, res) => {
  const { login, password } = req.body || {};
  if (!login || !password)
    return res.status(400).json({ error: "Identifiant et mot de passe requis." });

  const state = loginAttempts.get(login) || { count: 0, lockedUntil: 0 };
  if (state.lockedUntil > Date.now()) {
    const min = Math.ceil((state.lockedUntil - Date.now()) / 60000);
    return res.status(423).json({ error: `Compte bloque. Reessayez dans ${min} min.` });
  }

  const user = findUserByLogin(login);
  if (!user || user.password !== hashPwd(password)) {
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
      state.lockedUntil = Date.now() + LOCK_MS;
      state.count = 0;
      loginAttempts.set(login, state);
      return res
        .status(423)
        .json({ error: "Trop d'echecs : compte bloque 30 minutes." });
    }
    loginAttempts.set(login, state);
    return res.status(401).json({
      error: "Identifiant ou mot de passe incorrect.",
      tentativesRestantes: MAX_ATTEMPTS - state.count,
    });
  }

  // CU 11 : un medecin desactive ne peut plus exercer -> acces refuse.
  if (user.role === "MEDECIN" && user.etat === "Désactivé") {
    return res.status(403).json({ error: "Compte desactive : acces refuse." });
  }

  loginAttempts.delete(login);
  const token = crypto.randomUUID();
  const session = { id: user.id, role: user.role, nom: user.nom, prenom: user.prenom };
  
  const sessions = getSessions();
  sessions[token] = session;
  save();
  
  res.json({ token, user: publicUser(user) });
});

router.post("/logout", auth, (req, res) => {
  const token = (req.headers.authorization || "").slice(7);
  const sessions = getSessions();
  delete sessions[token];
  save();
  res.json({ ok: true });
});

router.get("/me", auth, (req, res) => {
  const u = findById("assureurs", req.user.id) || findById("medecins", req.user.id);
  res.json({ user: publicUser(u) });
});

router.put("/password", auth, (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: "Mot de passe requis." });
  const tableToSearch = req.user.role === "ASSUREUR" ? "assureurs" : "medecins";
  const user = findById(tableToSearch, req.user.id);
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
  user.password = hashPwd(password);
  save();
  res.json({ ok: true });
});

export default router;
