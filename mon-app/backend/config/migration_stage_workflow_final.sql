USE stagetec;

ALTER TABLE etudiants
  ADD COLUMN province VARCHAR(120) NULL
    AFTER ville;

ALTER TABLE entreprises
  ADD COLUMN province VARCHAR(120) NULL
    AFTER ville;

ALTER TABLE contrats
  MODIFY COLUMN statut ENUM(
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

  ADD COLUMN pdf_etudiant_signe_path VARCHAR(255) NULL
    AFTER pdf_original_path,

  ADD COLUMN milieu_signe_recu_le DATETIME NULL
    AFTER submitted_at,

  ADD COLUMN code_confirmation_reception VARCHAR(30) NULL
    AFTER milieu_signe_recu_le,

  ADD UNIQUE KEY uq_contrats_confirmation (
    code_confirmation_reception
  );

ALTER TABLE documents
  MODIFY COLUMN type_document ENUM(
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

  ADD COLUMN code_confirmation VARCHAR(30) NULL
    AFTER taille_octets;

ALTER TABLE notifications
  ADD COLUMN demande_stage_id BIGINT UNSIGNED NULL
    AFTER type_notification,

  ADD COLUMN contrat_id BIGINT UNSIGNED NULL
    AFTER demande_stage_id,

  ADD COLUMN lien_action VARCHAR(255) NULL
    AFTER contrat_id,

  ADD INDEX idx_notifications_demande (
    demande_stage_id
  ),

  ADD INDEX idx_notifications_contrat (
    contrat_id
  ),

  ADD CONSTRAINT fk_notifications_demande
    FOREIGN KEY (demande_stage_id)
    REFERENCES demandes_stage(id)
    ON DELETE SET NULL,

  ADD CONSTRAINT fk_notifications_contrat
    FOREIGN KEY (contrat_id)
    REFERENCES contrats(id)
    ON DELETE SET NULL;
