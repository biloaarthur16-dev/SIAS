import express from "express";
import { table, nextId, save, findById } from "../db.js";
import { auth, requireRole, enrichAssure } from "../utils.js";

const router = express.Router();

router.get("/", auth, (req, res) => {
  res.json(table("assures").map(enrichAssure));
});

router.get("/:id", auth, (req, res) => {
  const a = findById("assures", req.params.id);
  if (!a) return res.status(404).json({ error: "Assure introuvable." });
  res.json(enrichAssure(a));
});

router.post("/", auth, requireRole("ASSUREUR"), (req, res) => {
  const { nom, prenom, age, email, tel, profession, groupeSanguin, allergies } = req.body || {};
  if (!nom || !prenom || !email)
    return res.status(400).json({ error: "Nom, prenom et email sont obligatoires." });

  const exists = table("assures").some(
    (a) => a.email.toLowerCase() === String(email).toLowerCase()
  );
  if (exists) return res.status(409).json({ error: "Cet assure existe deja (email)." });

  const assure = {
    id: nextId("ASS"),
    role: "ASSURE",
    nom,
    prenom,
    age: age ? Number(age) : null,
    email,
    tel: tel || "",
    profession: profession || "",
    groupeSanguin: groupeSanguin || "",
    allergies: allergies || "",
    medecinTraitantId: null,
  };
  table("assures").push(assure);
  save();
  res.status(201).json(enrichAssure(assure));
});

router.delete("/:id", auth, requireRole("ASSUREUR"), (req, res) => {
  const t = table("assures");
  const idx = t.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Assure introuvable." });

  const hasConsultations = table("consultations").some(c => c.assureId === req.params.id);
  const hasFeuilles = table("feuilles").some(f => f.assureId === req.params.id);
  if (hasConsultations || hasFeuilles) {
    return res.status(409).json({
      error: "Impossible de supprimer : cet assure a des consultations ou des feuilles de maladie enregistrees."
    });
  }

  t.splice(idx, 1);
  save();
  res.json({ ok: true });
});

router.put("/:id/medecin-traitant", auth, requireRole("ASSUREUR"), (req, res) => {
  const assure = findById("assures", req.params.id);
  if (!assure) return res.status(404).json({ error: "Assure introuvable." });
  const { medecinId } = req.body || {};
  const medecin = findById("medecins", medecinId);
  if (!medecin) return res.status(404).json({ error: "Medecin introuvable." });

  const deja = !!assure.medecinTraitantId;
  assure.medecinTraitantId = medecinId;
  save();
  res.json({ ...enrichAssure(assure), miseAJour: deja });
});

export default router;
