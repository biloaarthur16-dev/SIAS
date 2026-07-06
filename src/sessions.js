// ---------------------------------------------------------------------------
// Sessions en memoire (jetons -> utilisateur). Ephemeres par nature : evite
// un aller-retour base a chaque requete. Perdues au redemarrage (acceptable).
// ---------------------------------------------------------------------------
const sessions = new Map();

export const createSession = (token, data) => { sessions.set(token, data); };
export const getSession = (token) => sessions.get(token) || null;
export const deleteSession = (token) => { sessions.delete(token); };
