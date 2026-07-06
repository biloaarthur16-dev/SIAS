import express from "express";
import { table, nextId, save, findById } from "../db.js";
import { auth, requireRole, enrichConsultation } from "../utils.js";

const router = express.Router();

router.get("/", auth, (req, res) => {
  let list = table("consultations");
  if (req.user.role === "MEDECIN") {
    list = list.filter(c => c.medecinId === req.user.id);
  }
  res.json(list.map(enrichConsultation));
});

router.post("/", auth, requireRole("MEDECIN", "ASSUREUR"), (req, res) => {
  const { assureId, date, motif } = req.body || {};
  const medecinId = req.user.role === "MEDECIN" ? req.user.id : req.body.medecinId;
  
  if (!assureId || !medecinId)
    return res.status(400).json({ error: "Assure et medecin sont obligatoires." });
  if (!findById("assures", assureId))
    return res.status(404).json({ error: "Assure introuvable." });
  if (!findById("medecins", medecinId))
    return res.status(404).json({ error: "Medecin introuvable." });

  const consultation = {
    id: nextId("CONS"),
    assureId,
    medecinId,
    date: date || new Date().toISOString().slice(0, 16),
    etat: "Effectuee",
    motif: motif || "",
  };
  table("consultations").push(consultation);
  save();
  res.status(201).json(enrichConsultation(consultation));
});

router.delete("/:id", auth, requireRole("ASSUREUR"), (req, res) => {
  const t = table("consultations");
  const idx = t.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Consultation introuvable." });
  t.splice(idx, 1);
  save();
  res.json({ ok: true });
});

export default router;
