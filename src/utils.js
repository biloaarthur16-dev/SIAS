import crypto from "node:crypto";
import { table, findById, getSessions } from "./db.js";

export const hashPwd = (p) => crypto.createHash("sha256").update(p).digest("hex");

export function findUserByLogin(login) {
  return (
    table("assureurs").find((u) => u.login === login) ||
    table("medecins").find((u) => u.login === login) ||
    null
  );
}

export function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}

export function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const sessions = getSessions();
  const session = token ? sessions[token] : null;
  if (!session) return res.status(401).json({ error: "Authentification requise." });
  req.user = session;
  next();
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

export function enrichAssure(a) {
  if (!a) return null;
  const med = a.medecinTraitantId ? findById("medecins", a.medecinTraitantId) : null;
  return { ...a, medecinTraitant: med ? personLabel(med) : null };
}

export function enrichConsultation(c) {
  return {
    ...c,
    assure: personLabel(findById("assures", c.assureId)),
    medecin: personLabel(findById("medecins", c.medecinId)),
  };
}

export function enrichFeuille(f) {
  const med = findById("medecins", f.medecinId);
  const remb = table("remboursements").find((r) => r.feuilleId === f.id);
  return {
    ...f,
    assure: personLabel(findById("assures", f.assureId)),
    medecin: personLabel(med),
    medecinType: med ? med.type : null,
    rembourse: !!remb,
    remboursementId: remb ? remb.id : null,
  };
}
