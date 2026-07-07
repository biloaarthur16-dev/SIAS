import express from "express";
import { all, get, insert, remove, nextId } from "../store.js";
import { auth, requireRole, enrichConsultation } from "../utils.js";

const router = express.Router();

router.get("/", auth, async (req, res, next) => {
  try {
    let list = await all("consultations");
    if (req.user.role === "MEDECIN") list = list.filter((c) => c.medecinId === req.user.id);
    res.json(await Promise.all(list.map(enrichConsultation)));
  } catch (err) { next(err); }
});

router.post("/", auth, requireRole("MEDECIN", "ASSUREUR"), async (req, res, next) => {
  try {
    const { assureId, date, motif } = req.body || {};
    const medecinId = req.user.role === "MEDECIN" ? req.user.id : req.body.medecinId;

    if (!assureId || !medecinId)
      return res.status(400).json({ error: "Assure et medecin sont obligatoires." });
    const assure = await get("assures", assureId);
    if (!assure)
      return res.status(404).json({ error: "Assure introuvable." });
    if (!(await get("medecins", medecinId)))
      return res.status(404).json({ error: "Medecin introuvable." });
    if (assure.medecinId === medecinId)
      return res.status(400).json({ error: "Un medecin ne peut pas se consulter lui-meme." });

    const consultation = await insert("consultations", {
      id: await nextId("CONS"),
      assureId,
      medecinId,
      date: date || new Date().toISOString().slice(0, 16),
      etat: "Effectuee",
      motif: motif || "",
    });
    res.status(201).json(await enrichConsultation(consultation));
  } catch (err) { next(err); }
});

router.delete("/:id", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const c = await get("consultations", req.params.id);
    if (!c) return res.status(404).json({ error: "Consultation introuvable." });
    await remove("consultations", req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
