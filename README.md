# SIAS — Gestion d'un organisme de sécurité sociale (projet CSI)

Application Node.js / Express + SPA (JavaScript vanilla), persistance **PostgreSQL**
(schéma relationnel normalisé dérivé du diagramme de classe métier).

## Prérequis

- Node.js ≥ 20
- PostgreSQL (local ou distant)

## Configuration

La connexion se fait via `DATABASE_URL` (lue depuis `.env`, non versionné) :

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/sias
```

Créer les deux bases (application + tests) :

```bash
psql -U postgres -c "CREATE DATABASE sias"
psql -U postgres -c "CREATE DATABASE sias_test"
```

Au démarrage, l'application crée le schéma (`src/schema.sql`) et charge les
données de démonstration si la base est vide (aucune migration manuelle requise).

## Démarrer

```bash
npm install
npm start        # http://localhost:3000
```

Comptes de démonstration :

| Rôle        | Login    | Mot de passe |
|-------------|----------|--------------|
| Assureur    | `admin`  | `admin123`   |
| Généraliste | `owen`   | `med123`     |
| Spécialiste | `nzoyem` | `med123`     |

## Tests

Les tests utilisent la base `sias_test` (réinitialisée à chaque démarrage du
serveur de test via `SEED_RESET=1`).

```bash
npm run test:api   # e2e API (node:test + fetch)
npm run test:e2e   # e2e navigateur (Playwright)
npm test           # les deux
```

## Architecture (couches)

- **Interface** : `public/` (SPA) + `server.js`
- **Contrôleur** : `src/routes/*`
- **Driver** : `src/pool.js` (pool pg) + `src/store.js` (repository, mapping SQL ⇄ objets)
- **Tables** : `src/schema.sql` (schéma normalisé + clés étrangères)
