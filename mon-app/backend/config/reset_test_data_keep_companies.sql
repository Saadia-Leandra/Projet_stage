-- Réinitialisation des données de test StageTec
--
-- Ce script vide les données transactionnelles et les comptes sans supprimer
-- les tables. Il conserve volontairement :
--   - entreprises : milieux de stage et adresses déjà enregistrés
--   - campus      : adresses de départ utilisées pour le kilométrage
--
-- Attention : cette opération est destructive et ne peut pas être annulée.
-- Base Aiven ciblée : defaultdb.
--
-- Depuis l'invite de commandes Windows (CMD), à la racine mon-app :
-- mysql.exe --host=VOTRE_HOTE_AIVEN --port=VOTRE_PORT --user=VOTRE_UTILISATEUR --password --ssl-mode=REQUIRED defaultdb < backend\config\reset_test_data_keep_companies.sql

USE defaultdb;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE destinataires_notification;
TRUNCATE TABLE notifications;

TRUNCATE TABLE lignes_rapport_paie;
TRUNCATE TABLE rapports_paie;

TRUNCATE TABLE destinations_deplacement;
TRUNCATE TABLE etudiants_deplacement_kilometrage;
TRUNCATE TABLE deplacements_kilometrage;

TRUNCATE TABLE etudiants_charge_paie;
TRUNCATE TABLE verrous_charge_paie_supervision;
TRUNCATE TABLE charges_paie_supervision;

TRUNCATE TABLE evenements_workflow;
TRUNCATE TABLE documents;
TRUNCATE TABLE signatures_contrat;
TRUNCATE TABLE contrats;
TRUNCATE TABLE demandes_stage;
TRUNCATE TABLE dossiers_stage;

TRUNCATE TABLE documenso_webhook_events;
TRUNCATE TABLE password_reset_tokens;

TRUNCATE TABLE etudiants;
TRUNCATE TABLE superviseurs;
TRUNCATE TABLE conseillere;
TRUNCATE TABLE comptabilite;
TRUNCATE TABLE direction;
TRUNCATE TABLE utilisateurs;

SET FOREIGN_KEY_CHECKS = 1;

-- Pour recréer ensuite les comptes et données de démonstration sur Aiven :
-- Pour recreer uniquement le compte Direction :
-- mysql.exe --host=VOTRE_HOTE_AIVEN --port=VOTRE_PORT --user=VOTRE_UTILISATEUR --password --ssl-mode=REQUIRED defaultdb < backend\config\seed_direction_only.sql
