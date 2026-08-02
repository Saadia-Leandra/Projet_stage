USE stagetec;

CREATE TABLE conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sujet VARCHAR(255) NOT NULL,
  demande_stage_id BIGINT UNSIGNED,
  contrat_id BIGINT UNSIGNED,
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversations_demande (demande_stage_id),
  INDEX idx_conversations_contrat (contrat_id),
  CONSTRAINT fk_conversations_demande
    FOREIGN KEY (demande_stage_id) REFERENCES demandes_stage(id) ON DELETE SET NULL,
  CONSTRAINT fk_conversations_contrat
    FOREIGN KEY (contrat_id) REFERENCES contrats(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE participants_conversation (
  conversation_id BIGINT UNSIGNED NOT NULL,
  utilisateur_id BIGINT UNSIGNED NOT NULL,
  dernier_message_lu_id BIGINT UNSIGNED,
  rejoint_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, utilisateur_id),
  INDEX idx_participants_conversation_utilisateur (utilisateur_id),
  INDEX idx_participants_conversation_dernier_message_lu (dernier_message_lu_id),
  CONSTRAINT fk_participants_conversation_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_participants_conversation_utilisateur
    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

CREATE TABLE messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  expediteur_id BIGINT UNSIGNED NOT NULL,
  contenu TEXT NOT NULL,
  envoye_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_messages_conversation_envoye (conversation_id, envoye_le, id),
  INDEX idx_messages_expediteur (expediteur_id),
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_expediteur
    FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id)
) ENGINE=InnoDB;

ALTER TABLE participants_conversation
  ADD CONSTRAINT fk_participants_conversation_dernier_message_lu
    FOREIGN KEY (dernier_message_lu_id) REFERENCES messages(id) ON DELETE SET NULL;
