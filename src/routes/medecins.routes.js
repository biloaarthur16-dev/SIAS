import express from "express";
import { table, nextId, save, findById } from "../db.js";
import { auth, requireRole, hashPwd, publicUser, findUserByLogin } from "../utils.js";

const router = express.Router();

router.get("/", auth, (req, res) => {
  let list = table("medecins");
  const { type, specialite } = req.query;
  if (type) list = list.filter((m) => m.type === type);
  if (specialite)
    list = list.filter(
      (m) => (m.specialite || "").toLowerCase().includes(String(specialite).toLowerCase())
    );
  res.json(req.user.role === "ASSUREUR" ? list : list.map(publicUser));
});

router.post("/", auth, requireRole("ASSUREUR"), (req, res) => {
  const { nom, prenom, age, email, tel, type, specialite, login, password } =
    req.body || {};
  if (!nom || !prenom || !type)
    return res.status(400).json({ error: "Nom, prenom et type sont obligatoires." });
  if (!["GENERALISTE", "SPECIALISTE"].includes(type))
    return res.status(400).json({ error: "Type invalide." });
  if (type === "SPECIALISTE" && !specialite)
    return res.status(400).json({ error: "La specialite est requise pour un specialiste." });

  const finalLogin =
    login ||
    [prenom, nom].filter(Boolean).join(".").toLowerCase().replace(/\s+/g, "");
  if (findUserByLogin(finalLogin))
    return res.status(409).json({ error: "Cet identifiant de connexion existe deja." });

  const plainPassword = password || "med123";
  const medecin = {
    id: nextId("MED"),
    role: "MEDECIN",
    type,
    specialite: type === "SPECIALISTE" ? specialite : null,
    nom,
    prenom,
    age: age ? Number(age) : null,
    email: email || "",
    tel: tel || "",
    login: finalLogin,
    password: hashPwd(plainPassword),
    etat: "Actif",
  };
  table("medecins").push(medecin);
  
  // Double profil Medecin -> Patient
  const assure = {
    id: nextId("ASS"),
    role: "ASSURE",
    nom,
    prenom,
    age: age ? Number(age) : null,
    email: email || "",
    tel: tel || "",
    profession: "Medecin",
    groupeSanguin: "",
    allergies: "",
    medecinTraitantId: null,
    isMedecin: true,
    medecinId: medecin.id
  };
  table("assures").push(assure);
  
  save();
  res.status(201).json({ ...publicUser(medecin), motDePasseParDefaut: plainPassword });
});

// CU 11 : Desactiver un medecin (transition d'etat Actif -> Desactive, reversible cote metier).
// Un medecin desactive ne peut plus s'authentifier ni exercer (voir garde dans utils.auth).
router.put("/:id/desactiver", auth, requireRole("ASSUREUR"), (req, res) => {
  const medecin = findById("medecins", req.params.id);
  if (!medecin) return res.status(404).json({ error: "Medecin introuvable." });
  if (medecin.etat === "Désactivé")
    return res.status(409).json({ error: "Ce medecin est deja desactive." });

  medecin.etat = "Désactivé";
  save();
  res.json(publicUser(medecin));
});

export default router;
