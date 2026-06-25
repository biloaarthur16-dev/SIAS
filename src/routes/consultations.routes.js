import express from "express";
import { table, nextId, save, findById } from "../db.js";
import { auth, requireRole, enrichConsultation, personLabel } from "../utils.js";

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

// Prescriptions
router.get("/prescriptions", auth, (req, res) => {
  let list = table("prescriptions");
  if (req.query.consultationId)
    list = list.filter((p) => p.consultationId === req.query.consultationId);
  if (req.user.role === "MEDECIN") {
    list = list.filter((p) => {
      const c = findById("consultations", p.consultationId);
      return c && c.medecinId === req.user.id;
    });
  }
  res.json(
    list.map((p) => ({
      ...p,
      consultation: p.consultationId
        ? personLabel(
            findById(
              "assures",
              (findById("consultations", p.consultationId) || {}).assureId
            )
          )
        : null,
    }))
  );
});

router.post("/prescriptions/medicament", auth, requireRole("MEDECIN"), (req, res) => {
  const { consultationId, nom, prix } = req.body || {};
  const c = findById("consultations", consultationId);
  if (!consultationId || !c)
    return res.status(404).json({ error: "Consultation introuvable." });
  if (c.medecinId !== req.user.id)
    return res.status(403).json({ error: "Cette consultation ne vous appartient pas." });
  if (!nom) return res.status(400).json({ error: "Nom du medicament requis." });

  const assure = findById("assures", c.assureId);
  if (assure && assure.allergies && assure.allergies.toLowerCase().includes(nom.toLowerCase())) {
    return res.status(400).json({ error: "Contre-indication : Ce patient est allergique à " + nom });
  }

  const presc = {
    id: nextId("PRESC"),
    type: "MEDICAMENT",
    consultationId,
    nom,
    prix: prix ? Number(prix) : 0,
    date: new Date().toISOString(),
  };
  table("prescriptions").push(presc);
  save();
  res.status(201).json(presc);
});

router.post("/prescriptions/consultation", auth, requireRole("MEDECIN"), (req, res) => {
  const { consultationId, specialiteRecommandee, specialisteId, motif } = req.body || {};
  const c = findById("consultations", consultationId);
  if (!consultationId || !c)
    return res.status(404).json({ error: "Consultation introuvable." });
  if (c.medecinId !== req.user.id)
    return res.status(403).json({ error: "Cette consultation ne vous appartient pas." });
  if (!specialiteRecommandee && !specialisteId)
    return res
      .status(400)
      .json({ error: "Indiquez une specialite ou un specialiste." });

  let specialiteFinale = specialiteRecommandee || null;
  if (specialisteId) {
    const spec = findById("medecins", specialisteId);
    if (!spec || spec.type !== "SPECIALISTE")
      return res.status(404).json({ error: "Specialiste introuvable." });
    specialiteFinale = specialiteFinale || spec.specialite;
  }

  const presc = {
    id: nextId("PRESC"),
    type: "CONSULTATION",
    consultationId,
    specialiteRecommandee: specialiteFinale,
    specialisteId: specialisteId || null,
    motif: motif || "",
    date: new Date().toISOString(),
  };
  table("prescriptions").push(presc);
  save();
  res.status(201).json(presc);
});

export default router;
