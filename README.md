# StageTec

## Presentation

StageTec est une application de gestion du processus de stage. Elle centralise les demandes de stage, les corrections, les contrats, les documents signes, les notifications internes et le suivi des signatures.

Le projet sert les principaux intervenants du workflow de stage :

- etudiants;
- enseignants superviseurs;
- conseillere;
- direction;
- milieux de stage.

L'objectif est d'eviter les suivis disperses et de conserver un historique administratif clair pour chaque demande.

## Fonctionnalites principales

- authentification et roles utilisateurs;
- creation d'une demande de stage;
- enregistrement en brouillon;
- une seule demande active par etudiant;
- modification de la meme demande lorsqu'une correction est permise;
- retrait logique d'une demande;
- historique des demandes;
- demandes de corrections et de documents manquants;
- approbation ou refus definitif par l'enseignant;
- generation du contrat uniquement apres approbation;
- depot du contrat signe par le milieu de stage;
- code de confirmation de reception;
- signatures electroniques Documenso pour les signatures administratives;
- notifications internes;
- suivi visuel des statuts.

## Workflow d'une demande

1. L'etudiant cree une demande.
2. Il peut l'enregistrer en brouillon, la modifier ou la soumettre.
3. L'enseignant traite la demande.
4. L'enseignant peut approuver, demander des corrections, demander des documents manquants ou refuser definitivement.
5. En cas de correction, l'etudiant modifie et resoumet la meme demande.
6. Aucun contrat n'est genere avant une approbation.
7. Aucun PDF ni document Documenso n'est genere apres un refus.
8. Apres approbation, StageTec genere une copie du contrat officiel.
9. L'etudiant complete le contrat et signe sa partie si elle est requise.
10. Le milieu de stage signe le contrat, puis l'etudiant depose le PDF signe.
11. StageTec genere un code de confirmation.
12. L'enseignant, la conseillere et la direction signent avec Documenso dans cet ordre.
13. Le PDF final est recupere et conserve.
14. Le dossier devient complet seulement apres la signature finale.

## Technologies

- React
- Vite
- Node.js
- Express
- MySQL
- `pdf-lib`
- Documenso API
- `node:test`
- oxlint

## Structure du projet

- `mon-app/backend/` : serveur Express, routes, services, configuration MySQL et tests backend.
- `mon-app/backend/config/` : schema SQL, migrations et seed.
- `mon-app/backend/templates/stage/` : copies de reference des modeles officiels.
- `mon-app/backend/storage/` : fichiers generes ou televerses, ignore par Git.
- `mon-app/src/frontend/` : composants React, constantes, styles et services frontend.
- `mon-app/docs/` : procedures de validation manuelle.

## Installation

```bash
cd mon-app
npm install
npm run dev
```

Par defaut, le serveur Express et le frontend Vite sont servis sur `http://localhost:3000`.

## Configuration

Copier `mon-app/backend/.env.example` vers `mon-app/backend/.env`, puis renseigner les variables locales :

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=stagetec
DB_USER=root
DB_PASSWORD=
JWT_SECRET=
PORT=3000

DOCUMENSO_API_URL=https://app.documenso.com/api/v2
DOCUMENSO_API_KEY=
DOCUMENSO_WEBHOOK_SECRET=
APP_PUBLIC_URL=
```

Ne pas committer `backend/.env`, les secrets, les fichiers televerses ni les PDF generes.

## Base de donnees

Le schema principal se trouve dans `mon-app/backend/config/dbstage.sql`.

Les migrations SQL disponibles sont dans `mon-app/backend/config/`. Elles doivent etre appliquees selon l'etat de la base locale, sans supprimer les donnees existantes.

## Documenso

Documenso est utilise pour les signatures electroniques. L'application doit aussi fonctionner sans configuration Documenso : dans ce cas, le serveur demarre, mais les actions de signature retournent une erreur claire et aucune signature n'est simulee.

Webhook a declarer :

```text
${APP_PUBLIC_URL}/api/webhooks/documenso
```

La procedure de test manuel est documentee dans `mon-app/docs/documenso-test-manuel.md`.

## Tests

Commandes disponibles dans `mon-app/package.json` :

```bash
cd mon-app
npm test
npm run build
npm run lint
```

Les tests Documenso automatises utilisent des validations locales et des mocks. Ils ne font pas d'appel reel a l'API externe.

## Securite

- authentification obligatoire sur les routes protegees;
- controles de roles cote backend;
- verification de propriete pour les demandes et contrats etudiants;
- requetes SQL parametrees;
- verrouillage transactionnel lors de la creation d'une demande active;
- generation de contrat limitee aux demandes approuvees;
- fichiers prives dans `backend/storage/`;
- secrets hors depot;
- validation backend des donnees et fichiers.

## Equipe

Les responsabilites nominatives ne sont pas detaillees dans ce README afin d'eviter d'attribuer une fonctionnalite sans source fiable dans le projet.

## Limites connues

- Un test reel Documenso necessite une cle API valide et un webhook public.
- Aucun service d'envoi de courriel reel n'est configure.
- Les notifications sont internes a l'application.
- Les positions de signature Documenso dependent du modele PDF officiel actuellement fourni.
