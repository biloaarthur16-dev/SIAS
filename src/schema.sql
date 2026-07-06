-- ---------------------------------------------------------------------------
-- Schema relationnel normalise (couche "Tables" de la base).
-- Derive du diagramme de classe metier. Montants en INTEGER (FCFA, sans
-- decimales) ; dates en TEXT (l'application fournit des chaines ISO precises).
-- ---------------------------------------------------------------------------

-- Compteurs pour les identifiants lisibles (ASS-1, MED-2, ...).
CREATE TABLE IF NOT EXISTS counters (
  prefix TEXT PRIMARY KEY,
  n      INTEGER NOT NULL DEFAULT 0
);

-- Acteur : organisme (assureur).
CREATE TABLE IF NOT EXISTS assureurs (
  id       TEXT PRIMARY KEY,
  role     TEXT NOT NULL DEFAULT 'ASSUREUR',
  nom      TEXT NOT NULL,
  prenom   TEXT DEFAULT '',
  email    TEXT,
  tel      TEXT,
  login    TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  etat     TEXT NOT NULL DEFAULT 'Actif'
);

-- Medecin (generaliste ou specialiste).
CREATE TABLE IF NOT EXISTS medecins (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL DEFAULT 'MEDECIN',
  type       TEXT NOT NULL CHECK (type IN ('GENERALISTE','SPECIALISTE')),
  specialite TEXT,
  nom        TEXT NOT NULL,
  prenom     TEXT DEFAULT '',
  age        INTEGER,
  email      TEXT,
  tel        TEXT,
  login      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  etat       TEXT NOT NULL DEFAULT 'Actif'
);

-- Assure (patient). Herite conceptuellement de Personne ; medecin traitant en FK.
CREATE TABLE IF NOT EXISTS assures (
  id                  TEXT PRIMARY KEY,
  role                TEXT NOT NULL DEFAULT 'ASSURE',
  nom                 TEXT NOT NULL,
  prenom              TEXT DEFAULT '',
  age                 INTEGER,
  email               TEXT,
  tel                 TEXT,
  profession          TEXT,
  groupe_sanguin      TEXT,
  allergies           TEXT,
  medecin_traitant_id TEXT REFERENCES medecins(id) ON DELETE SET NULL,
  is_medecin          BOOLEAN NOT NULL DEFAULT FALSE,
  medecin_id          TEXT REFERENCES medecins(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS specialites (
  id  TEXT PRIMARY KEY,
  nom TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS consultations (
  id         TEXT PRIMARY KEY,
  assure_id  TEXT NOT NULL REFERENCES assures(id)  ON DELETE RESTRICT,
  medecin_id TEXT NOT NULL REFERENCES medecins(id) ON DELETE RESTRICT,
  date       TEXT,
  etat       TEXT NOT NULL DEFAULT 'Effectuee',
  motif      TEXT
);

CREATE TABLE IF NOT EXISTS feuilles (
  id              TEXT PRIMARY KEY,
  assure_id       TEXT NOT NULL REFERENCES assures(id)       ON DELETE RESTRICT,
  medecin_id      TEXT NOT NULL REFERENCES medecins(id)      ON DELETE RESTRICT,
  consultation_id TEXT REFERENCES consultations(id)          ON DELETE SET NULL,
  montant_soins   INTEGER NOT NULL,
  montant_total   INTEGER,
  contenu         TEXT,
  etat            TEXT NOT NULL,
  date_creation   TEXT
);

-- Historique d'etats d'une feuille (attribut multivalue -> table fille).
CREATE TABLE IF NOT EXISTS feuille_etats (
  id         SERIAL PRIMARY KEY,
  feuille_id TEXT NOT NULL REFERENCES feuilles(id) ON DELETE CASCADE,
  etat       TEXT NOT NULL,
  date       TEXT
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id                     TEXT PRIMARY KEY,
  type                   TEXT NOT NULL CHECK (type IN ('MEDICAMENT','CONSULTATION')),
  consultation_id        TEXT NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  nom                    TEXT,
  prix                   INTEGER,
  specialite_recommandee TEXT,
  specialiste_id         TEXT REFERENCES medecins(id) ON DELETE SET NULL,
  motif                  TEXT,
  date                   TEXT
);

CREATE TABLE IF NOT EXISTS remboursements (
  id            TEXT PRIMARY KEY,
  feuille_id    TEXT NOT NULL UNIQUE REFERENCES feuilles(id) ON DELETE RESTRICT,
  assure_id     TEXT NOT NULL REFERENCES assures(id)         ON DELETE RESTRICT,
  medecin_type  TEXT,
  taux          INTEGER NOT NULL,
  montant_soins INTEGER,
  montant       INTEGER,
  mode_paiement TEXT NOT NULL,
  date_heure    TEXT,
  etat          TEXT NOT NULL
);

-- Historique d'etats d'un remboursement (attribut multivalue -> table fille).
CREATE TABLE IF NOT EXISTS remboursement_etats (
  id                SERIAL PRIMARY KEY,
  remboursement_id  TEXT NOT NULL REFERENCES remboursements(id) ON DELETE CASCADE,
  etat              TEXT NOT NULL,
  date              TEXT,
  detail            TEXT
);
