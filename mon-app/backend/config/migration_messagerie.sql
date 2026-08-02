CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  expediteur_id BIGINT UNSIGNED NOT NULL,
  destinataire_id BIGINT UNSIGNED NOT NULL,
  contenu TEXT NOT NULL,
  fichier_nom VARCHAR(255) NULL,
  fichier_chemin VARCHAR(255) NULL,
  fichier_mime VARCHAR(120) NULL,
  fichier_taille BIGINT UNSIGNED NULL,
  lu_le DATETIME NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_expediteur
    FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id),
  CONSTRAINT fk_messages_destinataire
    FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id),
  INDEX idx_messages_conversation (expediteur_id, destinataire_id, cree_le),
  INDEX idx_messages_boite (destinataire_id, lu_le)
) ENGINE=InnoDB;
