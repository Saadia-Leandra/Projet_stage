CREATE TABLE IF NOT EXISTS historique_document (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_id BIGINT UNSIGNED NOT NULL,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  action ENUM(
    'DEPOT',
    'NOUVELLE_VERSION',
    'TELECHARGEMENT',
    'ARCHIVAGE'
  ) NOT NULL,
  details JSON NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historique_document_document
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  CONSTRAINT fk_historique_document_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id),
  INDEX idx_historique_document_document (document_id, cree_le)
) ENGINE=InnoDB;
