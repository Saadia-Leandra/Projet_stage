USE defaultdb;

ALTER TABLE entreprises
  MODIFY COLUMN adresse VARCHAR(255) NULL;

ALTER TABLE demandes_stage
  MODIFY COLUMN date_debut DATE NULL,
  MODIFY COLUMN date_fin DATE NULL,
  ADD COLUMN retrait_motif TEXT NULL AFTER motif_refus,
  ADD COLUMN retiree_par_utilisateur_id BIGINT UNSIGNED NULL AFTER retrait_motif,
  ADD COLUMN retiree_le DATETIME NULL AFTER retiree_par_utilisateur_id,
  ADD CONSTRAINT fk_demandes_stage_retrait_utilisateur
    FOREIGN KEY (retiree_par_utilisateur_id) REFERENCES utilisateurs(id);
