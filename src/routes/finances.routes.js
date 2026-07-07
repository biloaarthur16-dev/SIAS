import express from "express";
import {
  all, get, insert, update, nextId,
  addFeuilleEtat, addRemboursementEtat, remboursementEtats,
} from "../store.js";
import { auth, requireRole, enrichFeuille, personLabel, publicUser } from "../utils.js";

const router = express.Router();

router.get("/feuilles", auth, async (req, res, next) => {
  try {
    let list = await all("feuilles");
    if (req.user.role === "MEDECIN") list = list.filter((f) => f.medecinId === req.user.id);
    res.json(await Promise.all(list.map(enrichFeuille)));
  } catch (err) { next(err); }
});

router.get("/feuilles/:id", auth, async (req, res, next) => {
  try {
    const f = await get("feuilles", req.params.id);
    if (!f) return res.status(404).json({ error: "Feuille introuvable." });
    res.json(await enrichFeuille(f));
  } catch (err) { next(err); }
});

router.post("/feuilles", auth, requireRole("MEDECIN"), async (req, res, next) => {
  try {
    const { assureId, consultationId, montantSoins, contenu } = req.body || {};
    if (!assureId) return res.status(400).json({ error: "Assure obligatoire." });
    if (!(await get("assures", assureId)))
      return res.status(404).json({ error: "Assure introuvable." });
    if (montantSoins == null || Number(montantSoins) <= 0)
      return res.status(400).json({ error: "Montant des soins invalide." });

    if (consultationId) {
      const c = await get("consultations", consultationId);
      if (!c || c.medecinId !== req.user.id)
        return res.status(403).json({ error: "Cette consultation ne vous appartient pas." });
    }

    const now = new Date().toISOString();
    const feuille = await insert("feuilles", {
      id: await nextId("FM"),
      assureId,
      medecinId: req.user.id,
      consultationId: consultationId || null,
      montantSoins: Number(montantSoins),
      montantTotal: Number(montantSoins),
      contenu: contenu || "",
      etat: "REMPLIE_PARTIELLEMENT",
      dateCreation: now,
    });
    await addFeuilleEtat(feuille.id, "VIERGE", now);
    await addFeuilleEtat(feuille.id, "REMPLIE_PARTIELLEMENT", now);
    res.status(201).json(await enrichFeuille(feuille));
  } catch (err) { next(err); }
});

router.put("/feuilles/:id/completer", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const feuille = await get("feuilles", req.params.id);
    if (!feuille) return res.status(404).json({ error: "Feuille introuvable." });
    if (feuille.etat === "ENREGISTREE")
      return res.status(409).json({ error: "Feuille deja enregistree." });

    const { montantTotal, contenu } = req.body || {};
    const patch = { etat: "ENREGISTREE" };
    if (montantTotal != null) patch.montantTotal = Number(montantTotal);
    if (contenu != null) patch.contenu = contenu;
    const updated = await update("feuilles", req.params.id, patch);

    const now = new Date().toISOString();
    await addFeuilleEtat(req.params.id, "REMPLIE", now);
    await addFeuilleEtat(req.params.id, "ENREGISTREE", now);
    res.json(await enrichFeuille(updated));
  } catch (err) { next(err); }
});

router.get("/remboursements", auth, async (req, res, next) => {
  try {
    const [list, assures] = await Promise.all([all("remboursements"), all("assures")]);
    const assureById = new Map(assures.map((a) => [a.id, a]));
    res.json(list.map((r) => ({ ...r, assure: personLabel(assureById.get(r.assureId)) })));
  } catch (err) { next(err); }
});

router.post("/remboursements", auth, requireRole("ASSUREUR"), async (req, res, next) => {
  try {
    const { feuilleId, modePaiement } = req.body || {};
    const feuille = await get("feuilles", feuilleId);
    if (!feuille) return res.status(404).json({ error: "Feuille introuvable." });
    if (feuille.etat !== "ENREGISTREE")
      return res.status(400).json({ error: "Feuille non conforme : elle doit etre completee/enregistree." });

    const remboursements = await all("remboursements");
    if (remboursements.find((r) => r.feuilleId === feuilleId))
      return res.status(409).json({ error: "Remboursement deja effectue pour cette feuille." });

    const mode = modePaiement === "ESPECES" ? "ESPECES" : "VIREMENT";
    const medecin = await get("medecins", feuille.medecinId);

    const taux = medecin && medecin.type === "GENERALISTE" ? 100 : 80;

    const montant = Math.round((feuille.montantSoins * taux) / 100);
    const now = new Date().toISOString();
    const remb = await insert("remboursements", {
      id: await nextId("REMB"),
      feuilleId,
      assureId: feuille.assureId,
      medecinType: medecin ? medecin.type : "SPECIALISTE",
      taux,
      montantSoins: feuille.montantSoins,
      montant,
      modePaiement: mode,
      dateHeure: now,
      etat: "ENREGISTRE",
    });

    await addRemboursementEtat(remb.id, "EN_ATTENTE", now);
    await addRemboursementEtat(remb.id, "ACCORDE", now);
    await addRemboursementEtat(remb.id, "EFFECTUE", now,
      mode === "VIREMENT" ? "Ordre transmis au systeme bancaire (confirme)" : "Decaissement en especes");
    await addRemboursementEtat(remb.id, "ENREGISTRE", now, "Consigne dans le registre des depenses");

    res.status(201).json({ ...remb, historiqueEtats: await remboursementEtats(remb.id) });
  } catch (err) { next(err); }
});

router.get("/remboursements/:id/facture", auth, async (req, res, next) => {
  try {
    const r = await get("remboursements", req.params.id);
    if (!r) return res.status(404).json({ error: "Remboursement introuvable." });
    const feuille = await get("feuilles", r.feuilleId);
    const assure = await get("assures", r.assureId);
    const medecin = feuille ? await get("medecins", feuille.medecinId) : null;
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
  } catch (err) { next(err); }
});

export default router;
