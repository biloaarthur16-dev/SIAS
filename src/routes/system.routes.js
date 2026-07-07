import express from "express";
import { all, insert, nextId, resetDb } from "../store.js";
import { auth, requireRole } from "../utils.js";

const router = express.Router();

router.get("/stats", auth, async (req, res, next) => {
  try {
    if (req.user.role === "MEDECIN") {
      const [assures, consultations, feuilles] = await Promise.all([
        all("assures"), all("consultations"), all("feuilles"),
      ]);
      const mesConsultations = consultations.filter((c) => c.medecinId === req.user.id);
      const mesFeuilles = feuilles.filter((f) => f.medecinId === req.user.id);
      const mesPatients = new Set([
        ...assures.filter((a) => a.medecinTraitantId === req.user.id).map((a) => a.id),
        ...mesConsultations.map((c) => c.assureId),
        ...mesFeuilles.map((f) => f.assureId),
      ]);
      return res.json({
        assures: mesPatients.size,
        consultations: mesConsultations.length,
        feuilles: mesFeuilles.length,
        feuillesEnregistrees: mesFeuilles.filter((f) => f.etat === "ENREGISTREE").length,
      });
    }

    const [assures, medecins, consultations, feuilles, remb] = await Promise.all([
      all("assures"), all("medecins"), all("consultations"), all("feuilles"), all("remboursements"),
    ]);
    res.json({
      assures: assures.length,
      medecins: medecins.length,
      consultations: consultations.length,
      feuilles: feuilles.length,
      feuillesEnregistrees: feuilles.filter((f) => f.etat === "ENREGISTREE").length,
      remboursements: remb.length,
      montantTotalRembourse: remb.reduce((s, r) => s + (r.montant || 0), 0),
    });
  } catch (err) { next(err); }
});

router.post("/admin/reset", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    await resetDb();
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Specialites dynamiques
router.get("/specialites", auth, async (req, res, next) => {
  try {
    res.json(await all("specialites"));
  } catch (err) { next(err); }
});

router.post("/specialites", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const { nom } = req.body || {};
    if (!nom || String(nom).trim() === "")
      return res.status(400).json({ error: "Le nom de la spécialité est requis." });

    const formattedNom = String(nom).trim();
    const specs = await all("specialites");
    if (specs.find((s) => s.nom.toLowerCase() === formattedNom.toLowerCase()))
      return res.status(409).json({ error: "Cette spécialité existe déjà." });

    const newSpec = await insert("specialites", { id: await nextId("SPEC"), nom: formattedNom });
    res.status(201).json(newSpec);
  } catch (err) { next(err); }
});

export default router;
