import crypto from "node:crypto";
import { all, get, feuilleEtats } from "./store.js";
import { getSession } from "./sessions.js";

export const hashPwd = (p) => crypto.createHash("sha256").update(p).digest("hex");

export async function findUserByLogin(login) {
  const assureurs = await all("assureurs");
  const found = assureurs.find((u) => u.login === login);
  if (found) return found;
  const medecins = await all("medecins");
  return medecins.find((u) => u.login === login) || null;
}

export function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

export async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const session = token ? getSession(token) : null;
    if (!session) return res.status(401).json({ error: "Authentification requise." });
    // CU 11 : bloque une session ouverte si le medecin a ete desactive entre-temps.
    if (session.role === "MEDECIN") {
      const med = await get("medecins", session.id);
      if (med && med.etat === "Désactivé")
        return res.status(403).json({ error: "Compte desactive : acces refuse." });
    }
    req.user = session;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ error: "Action non autorisee pour votre profil." });
    next();
  };
}

export function personLabel(p) {
  return p ? `${p.prenom || ""} ${p.nom || ""}`.trim() : "(inconnu)";
}

export async function enrichAssure(a) {
  if (!a) return null;
  const med = a.medecinTraitantId ? await get("medecins", a.medecinTraitantId) : null;
  return { ...a, medecinTraitant: med ? personLabel(med) : null };
}

export async function enrichConsultation(c) {
  const [assure, medecin] = await Promise.all([
    get("assures", c.assureId),
    get("medecins", c.medecinId),
  ]);
  return { ...c, assure: personLabel(assure), medecin: personLabel(medecin) };
}

export async function enrichFeuille(f) {
  const [med, remboursements] = await Promise.all([
    get("medecins", f.medecinId),
    all("remboursements"),
  ]);
  const [assure, historiqueEtats] = await Promise.all([
    get("assures", f.assureId),
    feuilleEtats(f.id),
  ]);
  const remb = remboursements.find((r) => r.feuilleId === f.id);
  return {
    ...f,
    historiqueEtats,
    assure: personLabel(assure),
    medecin: personLabel(med),
    medecinType: med ? med.type : null,
    rembourse: !!remb,
    remboursementId: remb ? remb.id : null,
  };
}
