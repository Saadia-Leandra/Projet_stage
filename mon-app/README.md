# StageTec

Application React + Express pour la gestion des demandes de stage, contrats, documents, notifications internes et signatures Documenso.

Le README principal du depot documente le workflow complet, les variables d'environnement, le webhook Documenso et la procedure de test manuel.

## Demarrage

```bash
npm install
npm run dev
```

Le serveur Express sert l'API et le frontend Vite sur `http://localhost:3000`.

## Verification

```bash
npm test
npm run build
npm run lint
```

## Configuration

Utiliser `backend/.env.example` comme base pour `backend/.env`. Ne jamais committer `backend/.env` ni les fichiers generes dans `backend/storage/`.
