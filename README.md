# StageTec

Application React + Express pour automatiser la gestion des demandes de stage, des contrats, des documents et des signatures.

## Workflow de stage

1. L'etudiant remplit et soumet une demande de stage.
2. L'enseignant approuve, demande des corrections, demande des documents manquants ou refuse definitivement.
3. Apres approbation, StageTec genere automatiquement une copie PDF du contrat officiel de l'ecole depuis `mon-app/backend/templates/stage/contrat-stage-officiel.pdf`.
4. L'etudiant complete les champs manquants du contrat, clique sur `Enregistrer et signer`, puis signe sa zone avec Documenso.
5. Apres confirmation Documenso, l'etudiant telecharge le PDF, le fait signer par le milieu de stage, puis le depose dans StageTec.
6. StageTec valide le PDF depose, cree un code de confirmation de reception et notifie l'enseignant.
7. L'enseignant, la conseillere et la direction signent ensuite avec Documenso, dans cet ordre.
8. Apres signature de la direction, StageTec recupere le PDF final, marque le dossier complet et notifie l'etudiant.

Le milieu de stage signe le PDF hors Documenso; l'enseignant, la conseillere et la direction signent electroniquement avec Documenso.

## Roles

- `ETUDIANT`: cree la demande, corrige la meme demande, complete et signe le contrat, depose le PDF signe par le milieu, consulte le recu et le contrat final.
- `SUPERVISEUR`: traite les demandes, demande des corrections/documents, approuve ou refuse definitivement, signe le contrat avec Documenso.
- `CONSEILLERE`: suit les contrats et signe avec Documenso apres l'enseignant.
- `DIRECTION`: effectue la signature finale et l'approbation definitive.

## Villes et provinces

Les formulaires de demande et correction utilisent des `datalist` HTML pour les villes principales du Quebec et les provinces/territoires canadiens. La saisie manuelle reste autorisee et la valeur saisie est conservee telle quelle.

## Une seule demande active

Un etudiant ne peut pas creer une deuxieme demande si une demande ou un dossier actif existe deja (`SOUMISE`, `A_REVISER`, `DOCUMENTS_MANQUANTS`, `APPROUVEE`, `DEMANDE_SOUMISE`, `CONTRAT_EN_COURS`, `ATTENTE_SIGNATURE`, `DOCUMENT_INCOMPLET`). Le backend retourne `409` avec un message clair.

## Corrections et documents manquants

Un refus definitif utilise `REFUSEE`. Les demandes pouvant etre corrigees utilisent `A_REVISER` ou `DOCUMENTS_MANQUANTS`. Le commentaire, les elements a corriger, les documents demandes, l'acteur et la date sont enregistres dans la demande et l'historique. La resoumission conserve le meme identifiant de demande et le meme dossier.

## Contrat et documents

Le modele original de l'ecole ne doit pas etre modifie. Les PDF generes et televerses sont stockes dans `mon-app/backend/storage/`, ignore par Git. Le depot du contrat signe par le milieu accepte uniquement un PDF valide, non vide, dans la taille maximale configuree. Le code de confirmation est de la forme `STG-2026-A8K4P2`.

## Notifications internes

StageTec cree des notifications internes pour les demandes soumises, corrections, documents manquants, resoumissions, approbations, contrat disponible, signature etudiante, depot milieu, signatures internes et dossier complet. Aucun courriel reel n'est envoye pour le moment.

## Variables d'environnement

Copier `mon-app/backend/.env.example` vers `mon-app/backend/.env` et configurer:

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

Sans `DOCUMENSO_API_KEY`, l'application demarre, mais aucune signature n'est simulee ni marquee comme signee.

## Webhook Documenso

Route backend: `POST /api/webhooks/documenso`

URL publique a declarer dans Documenso:

```text
${APP_PUBLIC_URL}/api/webhooks/documenso
```

En local, utiliser un tunnel public pour que Documenso atteigne le webhook. Le secret doit etre envoye par Documenso dans l'en-tete `X-Documenso-Secret`.

## Test manuel Documenso

1. Verifier que `DOCUMENSO_API_URL` pointe vers `https://app.documenso.com/api/v2`.
2. Renseigner une cle `DOCUMENSO_API_KEY` valide.
3. Exposer l'application locale avec un tunnel public et definir `APP_PUBLIC_URL`.
4. Declarer le webhook public dans Documenso avec le meme secret que `DOCUMENSO_WEBHOOK_SECRET`.
5. Approuver une demande de stage et verifier que le contrat PDF est genere.
6. Comme etudiant, completer le contrat et cliquer `Enregistrer et signer`.
7. Signer dans Documenso et verifier le webhook.
8. Deposer le PDF signe par le milieu dans StageTec.
9. Verifier que l'enseignant, la conseillere puis la direction recoivent chacun leur etape de signature.
10. Apres la direction, verifier que le PDF final est recupere et que l'etudiant recoit la notification finale.

Causes courantes d'echec: cle absente ou invalide, mauvaise URL API, webhook inaccessible, secret webhook incorrect, payload non reconnu, PDF invalide, champ de signature mal positionne, plan Documenso insuffisant.

## Commandes

```bash
cd mon-app
npm test
npm run build
npm run lint
npm run dev
```

## Limites connues

- Le test reel Documenso exige une cle valide et un webhook public; les tests automatises utilisent des validations/mocks locaux.
- Aucun service courriel reel n'est branche.
- Le champ de signature conseillere est positionne dans le PDF selon le meilleur emplacement disponible du modele actuel.
