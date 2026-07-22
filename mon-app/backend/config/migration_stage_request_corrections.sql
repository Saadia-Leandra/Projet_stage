USE stagetec;

ALTER TABLE demandes_stage
  MODIFY COLUMN statut ENUM(
    'BROUILLON',
    'SOUMISE',
    'A_REVISER',
    'DOCUMENTS_MANQUANTS',
    'APPROUVEE',
    'REFUSEE',
    'ANNULEE'
  ) NOT NULL DEFAULT 'SOUMISE',

  ADD COLUMN correction_raison TEXT NULL
    AFTER motif_refus,

  ADD COLUMN correction_elements TEXT NULL
    AFTER correction_raison,

  ADD COLUMN correction_documents_demandes TEXT NULL
    AFTER correction_elements,

  ADD COLUMN correction_commentaire_etudiant TEXT NULL
    AFTER correction_documents_demandes,

  ADD COLUMN correction_demandee_par_utilisateur_id BIGINT UNSIGNED NULL
    AFTER correction_commentaire_etudiant,

  ADD COLUMN correction_demandee_le DATETIME NULL
    AFTER correction_demandee_par_utilisateur_id,

  ADD COLUMN resoumis_le DATETIME NULL
    AFTER correction_demandee_le,

  ADD CONSTRAINT fk_demandes_stage_correction_demandeur
    FOREIGN KEY (correction_demandee_par_utilisateur_id)
    REFERENCES utilisateurs(id);

ALTER TABLE documents
  ADD COLUMN demande_stage_id BIGINT UNSIGNED NULL
    AFTER dossier_stage_id,

  MODIFY COLUMN type_document ENUM(
    'CONTRAT_GENERE',
    'CONTRAT_SIGNE',
    'ATTESTATION',
    'CAQ',
    'PERMIS_ETUDES',
    'ASSURANCE',
    'PIECE_IDENTITE',
    'CV',
    'AUTRE'
  ) NOT NULL DEFAULT 'AUTRE',

  ADD COLUMN type_mime VARCHAR(120) NULL
    AFTER chemin_fichier,

  ADD COLUMN taille_octets BIGINT UNSIGNED NULL
    AFTER type_mime,

  ADD CONSTRAINT fk_documents_demande
    FOREIGN KEY (demande_stage_id)
    REFERENCES demandes_stage(id)
    ON DELETE CASCADE;

CREATE INDEX idx_documents_demande_type
  ON documents (demande_stage_id, type_document, statut);
