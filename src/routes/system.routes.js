import express from "express";
import { table, save, resetDb, nextId } from "../db.js";
import { auth, requireRole } from "../utils.js";

const router = express.Router();

router.get("/stats", auth, (req, res) => {
  const remb = table("remboursements");
  res.json({
    assures: table("assures").length,
    medecins: table("medecins").length,
    consultations: table("consultations").length,
    feuilles: table("feuilles").length,
    feuillesEnregistrees: table("feuilles").filter((f) => f.etat === "ENREGISTREE").length,
    remboursements: remb.length,
    montantTotalRembourse: remb.reduce((s, r) => s + (r.montant || 0), 0),
  });
});

router.post("/admin/reset", auth, requireRole("ASSUREUR"), (req, res) => {
  resetDb();
  res.json({ ok: true });
});

// Nouvelles routes pour les spécialités dynamiques
router.get("/specialites", auth, (req, res) => {
  res.json(table("specialites"));
});

router.post("/specialites", auth, requireRole("ASSUREUR"), (req, res) => {
  const { nom } = req.body || {};
  if (!nom || String(nom).trim() === "") {
    return res.status(400).json({ error: "Le nom de la spécialité est requis." });
  }
  
  const formattedNom = String(nom).trim();
  const exists = table("specialites").find(s => s.nom.toLowerCase() === formattedNom.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: "Cette spécialité existe déjà." });
  }

  const newSpec = {
    id: nextId("SPEC"),
    nom: formattedNom
  };
  table("specialites").push(newSpec);
  save();
  
  res.status(201).json(newSpec);
});

export default router;
