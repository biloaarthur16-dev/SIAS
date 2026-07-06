import express from "express";
import { all, get, insert, nextId } from "../store.js";
import { auth, requireRole, personLabel } from "../utils.js";

const router = express.Router();

router.get("/", auth, async (req, res, next) => {
  try {
    let list = await all("prescriptions");
    if (req.query.consultationId)
      list = list.filter((p) => p.consultationId === req.query.consultationId);
    if (req.user.role === "MEDECIN") {
      const cons = await all("consultations");
      const mine = new Set(cons.filter((c) => c.medecinId === req.user.id).map((c) => c.id));
      list = list.filter((p) => mine.has(p.consultationId));
    }
    const consultations = await all("consultations");
    const assures = await all("assures");
    const consById = new Map(consultations.map((c) => [c.id, c]));
    const assureById = new Map(assures.map((a) => [a.id, a]));
    res.json(
      list.map((p) => {
        const c = p.consultationId ? consById.get(p.consultationId) : null;
        return { ...p, consultation: c ? personLabel(assureById.get(c.assureId)) : null };
      })
    );
  } catch (err) { next(err); }
});

// CU 6 : Prescrire un medicament
router.post("/medicament", auth, requireRole("MEDECIN"), async (req, res, next) => {
  try {
    const { consultationId, nom, prix } = req.body || {};
    const c = await get("consultations", consultationId);
    if (!consultationId || !c)
      return res.status(404).json({ error: "Consultation introuvable." });
    if (c.medecinId !== req.user.id)
      return res.status(403).json({ error: "Cette consultation ne vous appartient pas." });
    if (!nom) return res.status(400).json({ error: "Nom du medicament requis." });

    const assure = await get("assures", c.assureId);
    if (assure && assure.allergies && assure.allergies.toLowerCase().includes(nom.toLowerCase())) {
      return res.status(400).json({ error: "Contre-indication : Ce patient est allergique à " + nom });
    }

    const presc = await insert("prescriptions", {
      id: await nextId("PRESC"),
      type: "MEDICAMENT",
      consultationId,
      nom,
      prix: prix ? Number(prix) : 0,
      date: new Date().toISOString(),
    });
    res.status(201).json(presc);
  } catch (err) { next(err); }
});

// CU 5 : Prescrire une consultation chez un specialiste
router.post("/consultation", auth, requireRole("MEDECIN"), async (req, res, next) => {
  try {
    const { consultationId, specialiteRecommandee, specialisteId, motif } = req.body || {};
    const c = await get("consultations", consultationId);
    if (!consultationId || !c)
      return res.status(404).json({ error: "Consultation introuvable." });
    if (c.medecinId !== req.user.id)
      return res.status(403).json({ error: "Cette consultation ne vous appartient pas." });
    if (!specialiteRecommandee && !specialisteId)
      return res.status(400).json({ error: "Indiquez une specialite ou un specialiste." });

    let specialiteFinale = specialiteRecommandee || null;
    if (specialisteId) {
      const spec = await get("medecins", specialisteId);
      if (!spec || spec.type !== "SPECIALISTE")
        return res.status(404).json({ error: "Specialiste introuvable." });
      specialiteFinale = specialiteFinale || spec.specialite;
    }

    const presc = await insert("prescriptions", {
      id: await nextId("PRESC"),
      type: "CONSULTATION",
      consultationId,
      specialiteRecommandee: specialiteFinale,
      specialisteId: specialisteId || null,
      motif: motif || "",
      date: new Date().toISOString(),
    });
    res.status(201).json(presc);
  } catch (err) { next(err); }
});

export default router;
