# Service d'import CSV

Ce service transforme un CSV d'etudiants en donnees validees. Il ne se connecte
jamais directement a MySQL : seul le backend Node effectue les insertions.

## Demarrage local

Ouvrir un premier terminal dans `mon-app` :

```bat
npm run dev:csv
```

Puis ouvrir un deuxieme terminal :

```bat
npm run dev
```

La conseillere peut ensuite ouvrir **Importer des etudiants**, telecharger le
modele, verifier son fichier et confirmer l'importation.

Python 3.10 ou une version plus recente suffit. Aucune installation de paquet
Python n'est necessaire.

## Colonnes

Obligatoires :

- `courriel`
- `prenom`
- `nom`
- `mot_de_passe_temporaire` (8 caracteres minimum)
- `code_etudiant`
- `programme`

Les autres colonnes sont facultatives. Les dates utilisent `AAAA-MM-JJ`.
`numero_employe_superviseur`, lorsqu'il est fourni, doit deja exister dans la
table `superviseurs`.

## Securite

Definir une valeur secrete dans `backend/.env` :

```env
CSV_SERVICE_TOKEN=une-valeur-longue-et-aleatoire
```

Le service Python lit automatiquement cette configuration.
Le service ecoute uniquement sur `127.0.0.1` par defaut. Le CSV est valide une
seconde fois au moment de l'import et les insertions sont transactionnelles :
si une ligne echoue, aucune ligne du fichier n'est conservee.
