USE stagetec;

ALTER TABLE contrats
  ADD COLUMN external_id VARCHAR(120) NULL
    AFTER demande_stage_id,

  ADD COLUMN pdf_original_path VARCHAR(255) NULL
    AFTER chemin_fichier_genere,

  ADD COLUMN pdf_signed_path VARCHAR(255) NULL
    AFTER chemin_fichier_televerse,

  MODIFY COLUMN fournisseur_signature ENUM(
    'OPENSIGN',
    'DOCUSEAL',
    'SIGNWELL',
    'DOCUMENSO',
    'AUTRE'
  ) NULL,

  ADD COLUMN documenso_document_id VARCHAR(255) NULL
    AFTER document_externe_id,

  ADD COLUMN documenso_status VARCHAR(60) NULL
    AFTER documenso_document_id,

  ADD COLUMN submitted_at DATETIME NULL
    AFTER complete_le,

  ADD COLUMN completed_at DATETIME NULL
    AFTER submitted_at,

  ADD COLUMN rejected_at DATETIME NULL
    AFTER completed_at,

  ADD INDEX idx_contrats_external_id (external_id),

  ADD INDEX idx_contrats_documenso_document_id (documenso_document_id);

ALTER TABLE signatures_contrat
  MODIFY COLUMN fournisseur_signature ENUM(
    'OPENSIGN',
    'DOCUSEAL',
    'SIGNWELL',
    'DOCUMENSO',
    'AUTRE'
  ) NULL;

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
