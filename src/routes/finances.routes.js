import express from "express";
import { table, nextId, save, findById } from "../db.js";
import { auth, requireRole, enrichFeuille, personLabel, publicUser } from "../utils.js";

const router = express.Router();

router.get("/feuilles", auth, (req, res) => {
  let list = table("feuilles");
  if (req.user.role === "MEDECIN") {
    list = list.filter(f => f.medecinId === req.user.id);
  }
  res.json(list.map(enrichFeuille));
});

router.get("/feuilles/:id", auth, (req, res) => {
  const f = findById("feuilles", req.params.id);
  if (!f) return res.status(404).json({ error: "Feuille introuvable." });
  res.json(enrichFeuille(f));
});

router.post("/feuilles", auth, requireRole("MEDECIN"), (req, res) => {
  const { assureId, consultationId, montantSoins, contenu } = req.body || {};
  if (!assureId) return res.status(400).json({ error: "Assure obligatoire." });
  if (!findById("assures", assureId))
    return res.status(404).json({ error: "Assure introuvable." });
  if (montantSoins == null || Number(montantSoins) <= 0)
    return res.status(400).json({ error: "Montant des soins invalide." });
  
  if (consultationId) {
    const c = findById("consultations", consultationId);
    if (!c || c.medecinId !== req.user.id) {
      return res.status(403).json({ error: "Cette consultation ne vous appartient pas." });
    }
  }

  const feuille = {
    id: nextId("FM"),
    assureId,
    medecinId: req.user.id,
    consultationId: consultationId || null,
    montantSoins: Number(montantSoins),
    montantTotal: Number(montantSoins),
    contenu: contenu || "",
    etat: "REMPLIE_PARTIELLEMENT",
    historiqueEtats: [
      { etat: "VIERGE", date: new Date().toISOString() },
      { etat: "REMPLIE_PARTIELLEMENT", date: new Date().toISOString() },
    ],
    dateCreation: new Date().toISOString(),
  };
  table("feuilles").push(feuille);
  save();
  res.status(201).json(enrichFeuille(feuille));
});

router.put("/feuilles/:id/completer", auth, requireRole("ASSUREUR"), (req, res) => {
  const feuille = findById("feuilles", req.params.id);
  if (!feuille) return res.status(404).json({ error: "Feuille introuvable." });
  if (feuille.etat === "ENREGISTREE")
    return res.status(409).json({ error: "Feuille deja enregistree." });

  const { montantTotal, contenu } = req.body || {};
  if (montantTotal != null) feuille.montantTotal = Number(montantTotal);
  if (contenu != null) feuille.contenu = contenu;
  feuille.etat = "ENREGISTREE";
  feuille.historiqueEtats.push({ etat: "REMPLIE", date: new Date().toISOString() });
  feuille.historiqueEtats.push({ etat: "ENREGISTREE", date: new Date().toISOString() });
  save();
  res.json(enrichFeuille(feuille));
});

router.get("/remboursements", auth, (req, res) => {
  res.json(
    table("remboursements").map((r) => ({
      ...r,
      assure: personLabel(findById("assures", r.assureId)),
    }))
  );
});

router.post("/remboursements", auth, requireRole("ASSUREUR"), (req, res) => {
  const { feuilleId, modePaiement } = req.body || {};
  const feuille = findById("feuilles", feuilleId);
  if (!feuille) return res.status(404).json({ error: "Feuille introuvable." });
  if (feuille.etat !== "ENREGISTREE")
    return res
      .status(400)
      .json({ error: "Feuille non conforme : elle doit etre completee/enregistree." });

  const existing = table("remboursements").find((r) => r.feuilleId === feuilleId);
  if (existing)
    return res.status(409).json({ error: "Remboursement deja effectue pour cette feuille." });

  const mode = modePaiement === "ESPECES" ? "ESPECES" : "VIREMENT";
  const medecin = findById("medecins", feuille.medecinId);
  
  let taux = 80;
  if (medecin && medecin.type === "GENERALISTE") {
    taux = 100;
  } else {
    const specialiteMedecin = medecin ? medecin.specialite : null;
    const orientation = table("prescriptions").find(p => {
      if (p.type !== "CONSULTATION") return false;
      const cons = findById("consultations", p.consultationId);
      if (!cons || cons.assureId !== feuille.assureId) return false;
      const cibleMedecin = p.specialisteId === feuille.medecinId;
      const cibleSpecialite = specialiteMedecin &&
        p.specialiteRecommandee &&
        p.specialiteRecommandee.toLowerCase() === specialiteMedecin.toLowerCase();
      return cibleMedecin || cibleSpecialite;
    });
    if (!orientation) taux = 30;
  }
  
  const montant = Math.round((feuille.montantSoins * taux) / 100);

  const now = new Date().toISOString();
  const remb = {
    id: nextId("REMB"),
    feuilleId,
    assureId: feuille.assureId,
    medecinType: medecin ? medecin.type : "SPECIALISTE",
    taux,
    montantSoins: feuille.montantSoins,
    montant,
    modePaiement: mode,
    dateHeure: now,
    etat: "ENREGISTRE",
    historiqueEtats: [
      { etat: "EN_ATTENTE", date: now },
      { etat: "ACCORDE", date: now },
      {
        etat: "EFFECTUE",
        date: now,
        detail:
          mode === "VIREMENT"
            ? "Ordre transmis au systeme bancaire (confirme)"
            : "Decaissement en especes",
      },
      { etat: "ENREGISTRE", date: now, detail: "Consigne dans le registre des depenses" },
    ],
  };
  table("remboursements").push(remb);
  save();
  res.status(201).json(remb);
});

router.get("/remboursements/:id/facture", auth, (req, res) => {
  const r = findById("remboursements", req.params.id);
  if (!r) return res.status(404).json({ error: "Remboursement introuvable." });
  const feuille = findById("feuilles", r.feuilleId);
  const assure = findById("assures", r.assureId);
  const medecin = feuille ? findById("medecins", feuille.medecinId) : null;
  res.json({
    numero: r.id,
    date: r.dateHeure,
    assure: assure ? { ...publicUser(assure) } : null,
    medecin: medecin ? { nom: personLabel(medecin), type: medecin.type } : null,
    feuille: feuille ? { id: feuille.id, contenu: feuille.contenu } : null,
    montantSoins: r.montantSoins,
    taux: r.taux,
    montantRembourse: r.montant,
    modePaiement: r.modePaiement,
    etat: r.etat,
  });
});

export default router;
