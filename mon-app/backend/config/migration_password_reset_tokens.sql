deja existants CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expire_le DATETIME NOT NULL,
  nombre_tentatives TINYINT UNSIGNED NOT NULL DEFAULT 0,
  verifie_le DATETIME NULL,
  session_token_hash CHAR(64) NULL UNIQUE,
  session_expire_le DATETIME NULL,
  utilise_le DATETIME NULL,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_user (utilisateur_id),
  INDEX idx_password_reset_expiry (expire_le),
  CONSTRAINT fk_password_reset_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
