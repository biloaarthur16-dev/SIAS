import express from "express";
import { all, get, insert, update, remove, nextId } from "../store.js";
import { auth, requireRole, enrichAssure } from "../utils.js";

const router = express.Router();

router.get("/", auth, async (req, res, next) => {
  try {
    const list = await all("assures");
    res.json(await Promise.all(list.map(enrichAssure)));
  } catch (err) { next(err); }
});

router.get("/:id", auth, async (req, res, next) => {
  try {
    const a = await get("assures", req.params.id);
    if (!a) return res.status(404).json({ error: "Assure introuvable." });
    res.json(await enrichAssure(a));
  } catch (err) { next(err); }
});

router.post("/", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const { nom, prenom, age, email, tel, profession, groupeSanguin, allergies } = req.body || {};
    if (!nom || !prenom || !email)
      return res.status(400).json({ error: "Nom, prenom et email sont obligatoires." });

    const assures = await all("assures");
    const exists = assures.some((a) => (a.email || "").toLowerCase() === String(email).toLowerCase());
    if (exists) return res.status(409).json({ error: "Cet assure existe deja (email)." });

    const assure = await insert("assures", {
      id: await nextId("ASS"),
      role: "ASSURE",
      nom, prenom,
      age: age ? Number(age) : null,
      email,
      tel: tel || "",
      profession: profession || "",
      groupeSanguin: groupeSanguin || "",
      allergies: allergies || "",
      medecinTraitantId: null,
    });
    res.status(201).json(await enrichAssure(assure));
  } catch (err) { next(err); }
});

router.delete("/:id", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const a = await get("assures", req.params.id);
    if (!a) return res.status(404).json({ error: "Assure introuvable." });

    const [consultations, feuilles] = await Promise.all([all("consultations"), all("feuilles")]);
    const hasConsultations = consultations.some((c) => c.assureId === req.params.id);
    const hasFeuilles = feuilles.some((f) => f.assureId === req.params.id);
    if (hasConsultations || hasFeuilles) {
      return res.status(409).json({
        error: "Impossible de supprimer : cet assure a des consultations ou des feuilles de maladie enregistrees.",
      });
    }

    await remove("assures", req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.put("/:id/medecin-traitant", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const assure = await get("assures", req.params.id);
    if (!assure) return res.status(404).json({ error: "Assure introuvable." });
    const { medecinId } = req.body || {};
    const medecin = await get("medecins", medecinId);
    if (!medecin) return res.status(404).json({ error: "Medecin introuvable." });
    if (medecin.type !== "GENERALISTE")
      return res.status(400).json({ error: "Un specialiste ne peut pas etre medecin traitant." });

    const deja = !!assure.medecinTraitantId;
    const updated = await update("assures", req.params.id, { medecinTraitantId: medecinId });
    res.json({ ...(await enrichAssure(updated)), miseAJour: deja });
  } catch (err) { next(err); }
});

export default router;
