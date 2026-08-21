-- Seed minimal StageTec pour Aiven.
-- Il cree uniquement le profil Direction et ne supprime aucune donnee.
--
-- Connexion initiale :
--   Courriel     : direction@teccart.com
--   Mot de passe : secret123
-- Le changement du mot de passe sera exige a la premiere connexion.
--
-- Depuis CMD, a la racine de mon-app :
-- mysql.exe --host=VOTRE_HOTE_AIVEN --port=VOTRE_PORT --user=VOTRE_UTILISATEUR --password --ssl-mode=REQUIRED defaultdb < backend\config\seed_direction_only.sql

USE defaultdb;

START TRANSACTION;

INSERT INTO utilisateurs (
  courriel,
  mot_de_passe_hash,
  mot_de_passe_updated,
  prenom,
  nom,
  role,
  statut
)
VALUES (
  'direction@teccart.com',
  'scrypt:43lVUvURAAxQ6LYu25XaHw:XlJL4Mo-yPir5dOk0_eAhVNajoxvvTwbZoUE1D65iQQlxWtQ5u6hJDlfiNu_YcKBV0Si9JoA0EeXxDfX7GkCwQ',
  FALSE,
  'Alexis',
  'Martin',
  'DIRECTION',
  'ACTIF'
)
ON DUPLICATE KEY UPDATE
  prenom = 'Alexis',
  nom = 'Martin',
  role = 'DIRECTION',
  statut = 'ACTIF';

INSERT INTO direction (utilisateur_id, titre)
SELECT id, 'Direction'
FROM utilisateurs
WHERE courriel = 'direction@teccart.com'
ON DUPLICATE KEY UPDATE
  titre = 'Direction';

COMMIT;

SELECT
  u.id,
  u.courriel,
  u.prenom,
  u.nom,
  u.role,
  u.statut,
  d.titre
FROM utilisateurs u
JOIN direction d ON d.utilisateur_id = u.id
WHERE u.courriel = 'direction@teccart.com';
