CREATE DATABASE IF NOT EXISTS stagetec
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE stagetec;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS destinataires_notification;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS lignes_rapport_paie;
DROP TABLE IF EXISTS rapports_paie;
DROP TABLE IF EXISTS destinations_deplacement;
DROP TABLE IF EXISTS deplacements_kilometrage;
DROP TABLE IF EXISTS etudiants_charge_paie;
DROP TABLE IF EXISTS charges_paie_supervision;
DROP TABLE IF EXISTS evenements_workflow;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS documenso_webhook_events;
DROP TABLE IF EXISTS signatures_contrat;
DROP TABLE IF EXISTS contrats;
DROP TABLE IF EXISTS demandes_stage;
DROP TABLE IF EXISTS dossiers_stage;
DROP TABLE IF EXISTS entreprises;
DROP TABLE IF EXISTS campus;
DROP TABLE IF EXISTS direction;
DROP TABLE IF EXISTS comptabilite;
DROP TABLE IF EXISTS conseillere;
DROP TABLE IF EXISTS superviseurs;
DROP TABLE IF EXISTS etudiants;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS utilisateurs;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE utilisateurs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  courriel VARCHAR(255) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  prenom VARCHAR(80) NOT NULL,
  nom VARCHAR(80) NOT NULL,
  telephone VARCHAR(40),
  role ENUM('ETUDIANT', 'SUPERVISEUR', 'CONSEILLERE', 'COMPTABILITE', 'DIRECTION') NOT NULL,
  statut ENUM('ACTIF', 'INACTIF') NOT NULL DEFAULT 'ACTIF',
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expire_le DATETIME NOT NULL,
  utilise_le DATETIME NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_user (utilisateur_id),
  INDEX idx_password_reset_expiry (expire_le),
  CONSTRAINT fk_password_reset_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE superviseurs (
  utilisateur_id BIGINT UNSIGNED PRIMARY KEY,
  numero_employe VARCHAR(30) NOT NULL UNIQUE,
  departement VARCHAR(120),
  taux_horaire DECIMAL(8,3) NOT NULL DEFAULT 0.000,
  taux_kilometrique DECIMAL(6,3) NOT NULL DEFAULT 0.610,
  CONSTRAINT fk_superviseurs_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE etudiants (
  utilisateur_id BIGINT UNSIGNED PRIMARY KEY,
  superviseur_id BIGINT UNSIGNED,
  code_etudiant VARCHAR(30) NOT NULL UNIQUE,
  programme VARCHAR(120) NOT NULL,
  cohorte VARCHAR(30),
  adresse VARCHAR(255),
  ville VARCHAR(120),
  province VARCHAR(120),
  code_postal VARCHAR(20),
  code_permanent VARCHAR(30),
  groupe VARCHAR(60),
  expiration_caq DATE,
  expiration_permis_etudes DATE,
  expiration_assurance DATE,
  CONSTRAINT fk_etudiants_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  CONSTRAINT fk_etudiants_superviseur
    FOREIGN KEY (superviseur_id) REFERENCES superviseurs(utilisateur_id)
) ENGINE=InnoDB;

CREATE TABLE conseillere (
  utilisateur_id BIGINT UNSIGNED PRIMARY KEY,
  departement VARCHAR(120),
  CONSTRAINT fk_conseilleres_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE comptabilite (
  utilisateur_id BIGINT UNSIGNED PRIMARY KEY,
  numero_employe VARCHAR(30),
  service VARCHAR(120),
  CONSTRAINT fk_comptabilites_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE direction (
  utilisateur_id BIGINT UNSIGNED PRIMARY KEY,
  titre VARCHAR(120),
  CONSTRAINT fk_directions_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE campus (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  nom VARCHAR(120) NOT NULL,
  adresse VARCHAR(255) NOT NULL,
  ville VARCHAR(120),
  code_postal VARCHAR(20),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7)
) ENGINE=InnoDB;

CREATE TABLE entreprises (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  nom VARCHAR(180) NOT NULL,
  neq VARCHAR(30),
  adresse VARCHAR(255) NOT NULL,
  ville VARCHAR(120),
  province VARCHAR(120),
  code_postal VARCHAR(20),
  telephone VARCHAR(40),
  poste_telephonique VARCHAR(20),
  courriel VARCHAR(255),
  site_web VARCHAR(255),
  contact_rh_nom VARCHAR(160),
  contact_rh_courriel VARCHAR(255),
  contact_rh_telephone VARCHAR(40),
  contact_rh_poste VARCHAR(20),
  contact_signature_nom VARCHAR(160),
  contact_signature_courriel VARCHAR(255),
  superviseur_nom VARCHAR(160),
  superviseur_titre VARCHAR(160),
  superviseur_courriel VARCHAR(255),
  superviseur_telephone VARCHAR(40),
  horaire_travail VARCHAR(160),
  heures_semaine DECIMAL(5,2),
  langue_travail VARCHAR(80),
  type_organisation ENUM('PUBLIC', 'PRIVE'),
  secteur_activite VARCHAR(160),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7)
) ENGINE=InnoDB;

CREATE TABLE dossiers_stage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  etudiant_id BIGINT UNSIGNED NOT NULL,
  superviseur_id BIGINT UNSIGNED,
  statut ENUM(
    'DEMANDE_NON_CREEE',
    'DEMANDE_SOUMISE',
    'DEMANDE_REFUSEE',
    'CONTRAT_EN_COURS',
    'ATTENTE_SIGNATURE',
    'DOCUMENT_INCOMPLET',
    'DOSSIER_COMPLET'
  ) NOT NULL DEFAULT 'DEMANDE_NON_CREEE',
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dossiers_stage_etudiant
    FOREIGN KEY (etudiant_id) REFERENCES etudiants(utilisateur_id),
  CONSTRAINT fk_dossiers_stage_superviseur
    FOREIGN KEY (superviseur_id) REFERENCES superviseurs(utilisateur_id)
) ENGINE=InnoDB;

CREATE TABLE demandes_stage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_stage_id BIGINT UNSIGNED NOT NULL,
  entreprise_id BIGINT UNSIGNED NOT NULL,
  resume_taches TEXT,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  date_debut_disponibilite DATE,
  date_fin_disponibilite DATE,
  horaire_stage VARCHAR(160),
  heures_semaine DECIMAL(5,2),
  langue_travail VARCHAR(80),
  type_horaire ENUM('TEMPS_PARTIEL', 'TEMPS_PLEIN'),
  nombre_semaines DECIMAL(5,2),
  est_remunere BOOLEAN NOT NULL DEFAULT FALSE,
  salaire_horaire DECIMAL(8,2),
  autre_compensation VARCHAR(180),
  statut ENUM(
    'BROUILLON',
    'SOUMISE',
    'A_REVISER',
    'DOCUMENTS_MANQUANTS',
    'APPROUVEE',
    'REFUSEE',
    'ANNULEE'
  ) NOT NULL DEFAULT 'SOUMISE',
  motif_refus TEXT,
  correction_raison TEXT,
  correction_elements TEXT,
  correction_documents_demandes TEXT,
  correction_commentaire_etudiant TEXT,
  correction_demandee_par_utilisateur_id BIGINT UNSIGNED,
  correction_demandee_le DATETIME,
  resoumis_le DATETIME,
  decide_par_utilisateur_id BIGINT UNSIGNED,
  decide_le DATETIME,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_demandes_stage_dossier
    FOREIGN KEY (dossier_stage_id) REFERENCES dossiers_stage(id) ON DELETE CASCADE,
  CONSTRAINT fk_demandes_stage_entreprise
    FOREIGN KEY (entreprise_id) REFERENCES entreprises(id),
  CONSTRAINT fk_demandes_stage_decideur
    FOREIGN KEY (decide_par_utilisateur_id) REFERENCES utilisateurs(id),
  CONSTRAINT fk_demandes_stage_correction_demandeur
    FOREIGN KEY (correction_demandee_par_utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

CREATE TABLE contrats (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_stage_id BIGINT UNSIGNED NOT NULL,
  demande_stage_id BIGINT UNSIGNED NOT NULL UNIQUE,
  external_id VARCHAR(120),
  annee_scolaire VARCHAR(20),
  session VARCHAR(20),
  code_programme VARCHAR(40),
  fonction_stage VARCHAR(180),
  description_stage TEXT,
  est_remunere BOOLEAN NOT NULL DEFAULT FALSE,
  salaire_horaire DECIMAL(8,2),
  compensation_monetaire VARCHAR(180),
  autre_compensation VARCHAR(180),
  heures_semaine DECIMAL(5,2),
  nombre_semaines DECIMAL(5,2),
  total_heures DECIMAL(7,2),
  type_horaire ENUM('TEMPS_PARTIEL', 'TEMPS_PLEIN'),
  statut ENUM(
    'A_COMPLETER_ETUDIANT',
    'SIGNATURE_ETUDIANT',
    'CONTRAT_MILIEU_A_DEPOSER',
    'SIGNATURE_ENTREPRISE',
    'SIGNATURE_SUPERVISEUR',
    'SIGNATURE_CONSEILLERE',
    'SIGNATURE_DIRECTION',
    'DOSSIER_COMPLET',
    'REJETE'
  ) NOT NULL DEFAULT 'A_COMPLETER_ETUDIANT',
  chemin_fichier_genere VARCHAR(255),
  pdf_original_path VARCHAR(255),
  pdf_etudiant_signe_path VARCHAR(255),
  chemin_fichier_televerse VARCHAR(255),
  pdf_signed_path VARCHAR(255),
  fournisseur_signature ENUM('OPENSIGN', 'DOCUSEAL', 'SIGNWELL', 'DOCUMENSO', 'AUTRE'),
  enveloppe_externe_id VARCHAR(255),
  document_externe_id VARCHAR(255),
  documenso_document_id VARCHAR(255),
  documenso_status VARCHAR(60),
  url_signature TEXT,
  genere_le DATETIME,
  complete_le DATETIME,
  submitted_at DATETIME,
  milieu_signe_recu_le DATETIME,
  code_confirmation_reception VARCHAR(30),
  completed_at DATETIME,
  rejected_at DATETIME,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contrats_external_id (external_id),
  INDEX idx_contrats_documenso_document_id (documenso_document_id),
  UNIQUE KEY uq_contrats_confirmation (code_confirmation_reception),
  CONSTRAINT fk_contrats_dossier
    FOREIGN KEY (dossier_stage_id) REFERENCES dossiers_stage(id) ON DELETE CASCADE,
  CONSTRAINT fk_contrats_demande
    FOREIGN KEY (demande_stage_id) REFERENCES demandes_stage(id)
) ENGINE=InnoDB;

CREATE TABLE signatures_contrat (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  contrat_id BIGINT UNSIGNED NOT NULL,
  ordre_signature INT UNSIGNED NOT NULL,
  role_signataire ENUM('ETUDIANT', 'ENTREPRISE', 'SUPERVISEUR', 'CONSEILLERE', 'DIRECTION') NOT NULL,
  utilisateur_signataire_id BIGINT UNSIGNED,
  nom_signataire VARCHAR(160) NOT NULL,
  courriel_signataire VARCHAR(255) NOT NULL,
  statut ENUM('EN_ATTENTE', 'ENVOYE', 'SIGNE', 'REFUSE', 'EXPIRE') NOT NULL DEFAULT 'EN_ATTENTE',
  fournisseur_signature ENUM('OPENSIGN', 'DOCUSEAL', 'SIGNWELL', 'DOCUMENSO', 'AUTRE'),
  signature_externe_id VARCHAR(255),
  url_signature TEXT,
  signe_le DATETIME,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_signatures_contrat_ordre (contrat_id, ordre_signature),
  UNIQUE KEY uq_signatures_contrat_role (contrat_id, role_signataire),
  CONSTRAINT fk_signatures_contrat_contrat
    FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE CASCADE,
  CONSTRAINT fk_signatures_contrat_utilisateur
    FOREIGN KEY (utilisateur_signataire_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

CREATE TABLE documenso_webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_key CHAR(64) NOT NULL UNIQUE,
  event_type VARCHAR(80) NOT NULL,
  documenso_document_id VARCHAR(255),
  external_id VARCHAR(120),
  traite_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_documenso_webhook_document (documenso_document_id),
  INDEX idx_documenso_webhook_external (external_id)
) ENGINE=InnoDB;

CREATE TABLE documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_stage_id BIGINT UNSIGNED NOT NULL,
  demande_stage_id BIGINT UNSIGNED,
  contrat_id BIGINT UNSIGNED,
  depose_par_utilisateur_id BIGINT UNSIGNED NOT NULL,
  type_document ENUM(
    'CONTRAT_GENERE',
    'CONTRAT_SIGNE_ETUDIANT',
    'CONTRAT_SIGNE_MILIEU',
    'CONTRAT_SIGNE',
    'CONTRAT_FINAL',
    'ATTESTATION',
    'CAQ',
    'PERMIS_ETUDES',
    'ASSURANCE',
    'PIECE_IDENTITE',
    'CV',
    'AUTRE'
  ) NOT NULL DEFAULT 'AUTRE',
  nom_fichier VARCHAR(180) NOT NULL,
  chemin_fichier VARCHAR(255) NOT NULL,
  type_mime VARCHAR(120),
  taille_octets BIGINT UNSIGNED,
  code_confirmation VARCHAR(30),
  version_document INT UNSIGNED NOT NULL DEFAULT 1,
  statut ENUM('DEPOSE', 'VALIDE', 'REJETE', 'ARCHIVE') NOT NULL DEFAULT 'DEPOSE',
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_dossier
    FOREIGN KEY (dossier_stage_id) REFERENCES dossiers_stage(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_demande
    FOREIGN KEY (demande_stage_id) REFERENCES demandes_stage(id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_contrat
    FOREIGN KEY (contrat_id) REFERENCES contrats(id),
  CONSTRAINT fk_documents_utilisateur
    FOREIGN KEY (depose_par_utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

CREATE TABLE evenements_workflow (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_stage_id BIGINT UNSIGNED NOT NULL,
  utilisateur_acteur_id BIGINT UNSIGNED,
  type_evenement VARCHAR(80) NOT NULL,
  ancien_statut VARCHAR(50),
  nouveau_statut VARCHAR(50),
  commentaire TEXT,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evenements_workflow_dossier
    FOREIGN KEY (dossier_stage_id) REFERENCES dossiers_stage(id) ON DELETE CASCADE,
  CONSTRAINT fk_evenements_workflow_acteur
    FOREIGN KEY (utilisateur_acteur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

CREATE TABLE charges_paie_supervision (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  superviseur_id BIGINT UNSIGNED NOT NULL,
  dossier_stage_id BIGINT UNSIGNED,
  code_etudiant VARCHAR(30) NOT NULL,
  nom_etudiant VARCHAR(160) NOT NULL,
  heures_supervision DECIMAL(5,2) NOT NULL,
  taux_horaire DECIMAL(8,3) NOT NULL,
  montant_total DECIMAL(10,2) GENERATED ALWAYS AS (heures_supervision * taux_horaire) STORED,
  verrouille BOOLEAN NOT NULL DEFAULT TRUE,
  statut ENUM('CALCULE', 'VALIDE', 'REJETE', 'EXPORTE') NOT NULL DEFAULT 'CALCULE',
  motif_refus TEXT,
  exporte_le DATETIME,
  lot_export_id VARCHAR(80),
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_charges_paie_superviseur
    FOREIGN KEY (superviseur_id) REFERENCES superviseurs(utilisateur_id),
  CONSTRAINT fk_charges_paie_dossier
    FOREIGN KEY (dossier_stage_id) REFERENCES dossiers_stage(id),
  CONSTRAINT ck_charges_paie_heures CHECK (heures_supervision > 0)
) ENGINE=InnoDB;

CREATE TABLE etudiants_charge_paie (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  charge_paie_supervision_id BIGINT UNSIGNED NOT NULL,
  etudiant_id BIGINT UNSIGNED NOT NULL,
  commentaire TEXT,
  UNIQUE KEY uq_etudiants_charge_paie (charge_paie_supervision_id, etudiant_id),
  CONSTRAINT fk_etudiants_charge_paie_charge
    FOREIGN KEY (charge_paie_supervision_id) REFERENCES charges_paie_supervision(id) ON DELETE CASCADE,
  CONSTRAINT fk_etudiants_charge_paie_etudiant
    FOREIGN KEY (etudiant_id) REFERENCES etudiants(utilisateur_id)
) ENGINE=InnoDB;

CREATE TABLE deplacements_kilometrage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  superviseur_id BIGINT UNSIGNED NOT NULL,
  campus_id BIGINT UNSIGNED NOT NULL,
  programme VARCHAR(120),
  groupe VARCHAR(60),
  date_deplacement DATE NOT NULL,
  type_trajet ENUM('ALLER_SIMPLE', 'ALLER_RETOUR') NOT NULL,
  fournisseur_calcul VARCHAR(60) NOT NULL,
  distance_km DECIMAL(8,2) NOT NULL,
  duree_minutes INT UNSIGNED NOT NULL,
  taux_kilometrique DECIMAL(6,3) NOT NULL DEFAULT 0.610,
  montant_stationnement DECIMAL(8,2) NOT NULL DEFAULT 0.00,
  montant_remboursement DECIMAL(10,2) GENERATED ALWAYS AS (distance_km * taux_kilometrique + montant_stationnement) STORED,
  url_carte VARCHAR(500),
  instantane_itineraire JSON,
  trace_gps JSON,
  depart_reel_le DATETIME,
  arrivee_reelle_le DATETIME,
  preuve_stationnement_nom VARCHAR(255),
  preuve_stationnement_type VARCHAR(100),
  preuve_stationnement_fichier VARCHAR(255),
  verrouille BOOLEAN NOT NULL DEFAULT TRUE,
  statut ENUM('CALCULE', 'VALIDE', 'REJETE', 'EXPORTE') NOT NULL DEFAULT 'CALCULE',
  motif_refus TEXT,
  calcule_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exporte_le DATETIME,
  lot_export_id VARCHAR(80),
  CONSTRAINT fk_deplacements_superviseur
    FOREIGN KEY (superviseur_id) REFERENCES superviseurs(utilisateur_id),
  CONSTRAINT fk_deplacements_campus
    FOREIGN KEY (campus_id) REFERENCES campus(id),
  CONSTRAINT ck_deplacements_distance CHECK (distance_km >= 0)
) ENGINE=InnoDB;

CREATE TABLE destinations_deplacement (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  deplacement_kilometrage_id BIGINT UNSIGNED NOT NULL,
  entreprise_id BIGINT UNSIGNED,
  ordre_destination INT UNSIGNED NOT NULL,
  libelle_destination VARCHAR(180) NOT NULL,
  adresse_destination VARCHAR(255) NOT NULL,
  CONSTRAINT fk_destinations_deplacement_deplacement
    FOREIGN KEY (deplacement_kilometrage_id) REFERENCES deplacements_kilometrage(id) ON DELETE CASCADE,
  CONSTRAINT fk_destinations_deplacement_entreprise
    FOREIGN KEY (entreprise_id) REFERENCES entreprises(id)
) ENGINE=InnoDB;

CREATE TABLE rapports_paie (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date_debut_periode DATE NOT NULL,
  date_fin_periode DATE NOT NULL,
  statut ENUM('BROUILLON', 'VERROUILLE', 'EXPORTE') NOT NULL DEFAULT 'BROUILLON',
  cree_par_utilisateur_id BIGINT UNSIGNED NOT NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exporte_le DATETIME,
  CONSTRAINT fk_rapports_paie_createur
    FOREIGN KEY (cree_par_utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

CREATE TABLE lignes_rapport_paie (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rapport_paie_id BIGINT UNSIGNED NOT NULL,
  superviseur_id BIGINT UNSIGNED NOT NULL,
  montant_supervision DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  montant_kilometrage DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  montant_total DECIMAL(10,2) GENERATED ALWAYS AS (montant_supervision + montant_kilometrage) STORED,
  CONSTRAINT fk_lignes_rapport_paie_rapport
    FOREIGN KEY (rapport_paie_id) REFERENCES rapports_paie(id) ON DELETE CASCADE,
  CONSTRAINT fk_lignes_rapport_paie_superviseur
    FOREIGN KEY (superviseur_id) REFERENCES superviseurs(utilisateur_id)
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titre VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  type_notification VARCHAR(60) NOT NULL,
  demande_stage_id BIGINT UNSIGNED,
  contrat_id BIGINT UNSIGNED,
  lien_action VARCHAR(255),
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_demande (demande_stage_id),
  INDEX idx_notifications_contrat (contrat_id),
  CONSTRAINT fk_notifications_demande
    FOREIGN KEY (demande_stage_id) REFERENCES demandes_stage(id) ON DELETE SET NULL,
  CONSTRAINT fk_notifications_contrat
    FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE destinataires_notification (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  notification_id BIGINT UNSIGNED NOT NULL,
  utilisateur_destinataire_id BIGINT UNSIGNED NOT NULL,
  lu_le DATETIME,
  UNIQUE KEY uq_destinataires_notification (notification_id, utilisateur_destinataire_id),
  CONSTRAINT fk_destinataires_notification_notification
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_destinataires_notification_utilisateur
    FOREIGN KEY (utilisateur_destinataire_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;
