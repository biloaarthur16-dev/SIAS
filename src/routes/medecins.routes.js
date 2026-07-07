import express from "express";
import { all, get, insert, update, nextId } from "../store.js";
import { auth, requireRole, hashPwd, publicUser, findUserByLogin } from "../utils.js";

const router = express.Router();

router.get("/", auth, async (req, res, next) => {
  try {
    let list = await all("medecins");
    const { type, specialite } = req.query;
    if (type) list = list.filter((m) => m.type === type);
    if (specialite)
      list = list.filter((m) => (m.specialite || "").toLowerCase().includes(String(specialite).toLowerCase()));
    res.json(req.user.role === "ASSUREUR" ? list : list.map(publicUser));
  } catch (err) { next(err); }
});

router.post("/", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const { nom, prenom, age, email, tel, type, specialite, login, password } = req.body || {};
    if (!nom || !prenom || !type)
      return res.status(400).json({ error: "Nom, prenom et type sont obligatoires." });
    if (!["GENERALISTE", "SPECIALISTE"].includes(type))
      return res.status(400).json({ error: "Type invalide." });
    if (type === "SPECIALISTE" && !specialite)
      return res.status(400).json({ error: "La specialite est requise pour un specialiste." });

    const finalLogin =
      login || [prenom, nom].filter(Boolean).join(".").toLowerCase().replace(/\s+/g, "");
    if (await findUserByLogin(finalLogin))
      return res.status(409).json({ error: "Cet identifiant de connexion existe deja." });

    const plainPassword = password || "med123";
    const medecin = await insert("medecins", {
      id: await nextId("MED"),
      role: "MEDECIN",
      type,
      specialite: type === "SPECIALISTE" ? specialite : null,
      nom, prenom,
      age: age ? Number(age) : null,
      email: email || "",
      tel: tel || "",
      login: finalLogin,
      password: hashPwd(plainPassword),
      etat: "Actif",
    });

    // Double profil Medecin -> Assure (patient).
    await insert("assures", {
      id: await nextId("ASS"),
      role: "ASSURE",
      nom, prenom,
      age: age ? Number(age) : null,
      email: email || "",
      tel: tel || "",
      profession: "Medecin",
      groupeSanguin: "",
      allergies: "",
      medecinTraitantId: null,
      isMedecin: true,
      medecinId: medecin.id,
    });

    res.status(201).json({ ...publicUser(medecin), motDePasseParDefaut: plainPassword });
  } catch (err) { next(err); }
});

// CU 11 : Desactiver un medecin (transition d'etat Actif -> Desactive, reversible cote metier).
// Un medecin desactive ne peut plus s'authentifier ni exercer (voir garde dans utils.auth).
router.put("/:id/desactiver", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const medecin = await get("medecins", req.params.id);
    if (!medecin) return res.status(404).json({ error: "Medecin introuvable." });
    if (medecin.etat === "Désactivé")
      return res.status(409).json({ error: "Ce medecin est deja desactive." });

    const updated = await update("medecins", req.params.id, { etat: "Désactivé" });
    res.json(publicUser(updated));
  } catch (err) { next(err); }
});

// CU 11bis : Reactiver un medecin (transition d'etat Desactive -> Actif).
router.put("/:id/activer", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const medecin = await get("medecins", req.params.id);
    if (!medecin) return res.status(404).json({ error: "Medecin introuvable." });
    if (medecin.etat !== "Désactivé")
      return res.status(409).json({ error: "Ce medecin est deja actif." });

    const updated = await update("medecins", req.params.id, { etat: "Actif" });
    res.json(publicUser(updated));
  } catch (err) { next(err); }
});

export default router;
