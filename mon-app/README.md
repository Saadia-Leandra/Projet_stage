# StageTec

Application React + Express pour extraire progressivement la plateforme StageTec.
La version actuelle contient seulement l'authentification.

## Demarrage

```bash
npm.cmd run dev:backend
```

Le serveur Express sert l'API et le frontend Vite en middleware sur `http://localhost:3000`.

## Base de donnees

La connexion MySQL utilise `src/backend/.env`.

```env
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=stagetec
DB_USER=root
DB_PASSWORD=
JWT_SECRET=dev-secret
```

Le schema de reference est dans `../config/dbstage.sql`.
Les donnees de test sont dans `../config/seed.sql`.

## Authentification

Routes disponibles:

- `POST /api/auth/login`
- `GET /api/auth/me`

Le login accepte:

- `utilisateurs.courriel`
- `etudiants.code_permanent`
- `etudiants.code_etudiant`
- `superviseurs.numero_employe`

Les mots de passe en base peuvent etre verifies avec les formats:

- `scrypt:...` utilise par le seed SQL actuel

Comptes presents dans `../config/seed.sql`:

- `marie@teccart.com`
- `samir@teccart.com`
- `tom@teccart.com`
- `jessica@teccart.com`
- `claire@teccart.com`
- `compta@teccart.com`
- `direction@teccart.com`

Le mot de passe de test de ces comptes est `secret123`.

## Dependances installees

Dependances runtime:

- `react`: librairie frontend.
- `react-dom`: rendu React dans le navigateur.
- `express`: serveur backend et routes API.
- `mysql2`: connexion MySQL avec promesses.
- `dotenv`: chargement des variables depuis `.env`.
- `jsonwebtoken`: creation et verification des tokens JWT.

Dependances de developpement:

- `vite`: serveur de developpement et build frontend.
- `@vitejs/plugin-react`: integration React pour Vite.
- `oxlint`: verification statique du code.
- `@types/react`: types React.
- `@types/react-dom`: types React DOM.

## Scripts npm

- `npm.cmd run dev`: lance Vite seul.
- `npm.cmd run dev:backend`: lance le serveur Express complet.
- `npm.cmd run start`: lance le serveur Express complet.
- `npm.cmd run build`: compile le frontend.
- `npm.cmd run lint`: lance Oxlint.
- `npm.cmd run preview`: preview du build Vite.
