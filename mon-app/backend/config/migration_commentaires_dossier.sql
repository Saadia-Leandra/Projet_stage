CREATE TABLE IF NOT EXISTS commentaires_dossier (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dossier_stage_id BIGINT UNSIGNED NOT NULL,
  auteur_utilisateur_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  contenu TEXT NOT NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  supprime_le DATETIME NULL,
  CONSTRAINT fk_commentaires_dossier_dossier
    FOREIGN KEY (dossier_stage_id) REFERENCES dossiers_stage(id) ON DELETE CASCADE,
  CONSTRAINT fk_commentaires_dossier_auteur
    FOREIGN KEY (auteur_utilisateur_id) REFERENCES utilisateurs(id),
  CONSTRAINT fk_commentaires_dossier_parent
    FOREIGN KEY (parent_id) REFERENCES commentaires_dossier(id) ON DELETE CASCADE,
  INDEX idx_commentaires_dossier_dossier (dossier_stage_id, cree_le)
) ENGINE=InnoDB;
