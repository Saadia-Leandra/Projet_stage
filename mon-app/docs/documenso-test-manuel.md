# Procedure de test manuel Documenso

Cette procedure sert a valider l'integration reelle Documenso. Les tests automatises ne doivent pas appeler l'API externe.

## Configuration

1. Creer ou recuperer une cle API Documenso dans le compte utilise pour les signatures.
2. Copier `mon-app/backend/.env.example` vers `mon-app/backend/.env`.
3. Renseigner les variables suivantes sans les committer :
   - `DOCUMENSO_API_URL=https://app.documenso.com/api/v2`
   - `DOCUMENSO_API_KEY=...`
   - `DOCUMENSO_WEBHOOK_SECRET=...`
   - `APP_PUBLIC_URL=https://adresse-publique`
4. Exposer l'application locale avec une URL publique si le test est fait en local.
5. Declarer le webhook dans Documenso :

```text
${APP_PUBLIC_URL}/api/webhooks/documenso
```

Le webhook doit envoyer le secret configure dans l'en-tete `X-Documenso-Secret`.

## Scenario de validation

1. Creer une demande de stage avec un compte etudiant.
2. Soumettre la demande.
3. Approuver la demande avec le compte enseignant assigne.
4. Verifier qu'un contrat est cree et qu'une copie PDF est generee depuis le modele officiel.
5. Ouvrir le contrat avec le compte etudiant.
6. Completer les champs obligatoires.
7. Cliquer sur `Enregistrer et signer`.
8. Verifier dans Documenso que le document, le destinataire et le champ de signature etudiant existent.
9. Signer avec le lien Documenso de l'etudiant.
10. Attendre le webhook Documenso et verifier que le statut StageTec passe a l'etape du milieu.
11. Telecharger le PDF a faire signer par le milieu si necessaire.
12. Faire signer le document par le milieu de stage.
13. Deposer le PDF signe dans StageTec.
14. Verifier le code de confirmation `STG-AAAA-XXXXXX`.
15. Verifier que l'enseignant recoit l'etape de signature Documenso.
16. Signer comme enseignant et attendre le webhook.
17. Verifier que l'etape passe a la conseillere.
18. Signer comme conseillere et attendre le webhook.
19. Verifier que l'etape passe a la direction.
20. Signer comme direction et attendre le webhook final.
21. Verifier que StageTec recupere le PDF final signe.
22. Verifier que le dossier passe a `DOSSIER_COMPLET` et que l'etudiant voit le message final.

## Points a verifier

- Le serveur demarre meme sans `DOCUMENSO_API_KEY`.
- Une tentative de signature sans configuration retourne une erreur claire.
- Aucun clic StageTec ne marque une signature comme terminee sans webhook Documenso.
- Le webhook invalide est rejete.
- Le webhook duplique ne modifie pas deux fois le meme evenement.
- Le PDF final est valide et telechargeable seulement quand le dossier est complet.

## Erreurs courantes

- Cle API absente ou invalide.
- `DOCUMENSO_API_URL` incorrecte.
- Endpoint Documenso obsolete.
- Payload non conforme pour les destinataires ou les champs.
- Webhook inaccessible depuis Internet.
- Secret webhook incorrect.
- Mauvais corps HTTP ou evenement inconnu.
- Position de signature incorrecte dans le PDF.
- PDF invalide ou vide.
- Courriel de signataire invalide.
- Restriction du compte Documenso.
