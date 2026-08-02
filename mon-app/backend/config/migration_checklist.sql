CREATE TABLE IF NOT EXISTS checklist_document (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_stage_id BIGINT UNSIGNED NOT NULL,
  type_document ENUM('CV', 'ATTESTATION', 'ASSURANCE', 'CAQ', 'PERMIS_ETUDES') NOT NULL,
  est_a_jour BOOLEAN NOT NULL DEFAULT FALSE,
  coche_par_utilisateur_id BIGINT UNSIGNED NULL,
  modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checklist_dossier_type (dossier_stage_id, type_document),
  CONSTRAINT fk_checklist_dossier
    FOREIGN KEY (dossier_stage_id) REFERENCES dossiers_stage(id) ON DELETE CASCADE,
  CONSTRAINT fk_checklist_utilisateur
    FOREIGN KEY (coche_par_utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;
