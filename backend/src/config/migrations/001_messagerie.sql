-- ===========================================================================
-- NAATAL DAKAR — Migration 001 : messagerie privée
-- ===========================================================================
-- Cette migration est idempotente (CREATE TABLE IF NOT EXISTS). Elle est aussi
-- appliquée automatiquement au démarrage du backend par src/config/db.js à
-- partir de src/config/schema.sql. Le fichier est fourni pour les déploiements
-- où le schéma est géré manuellement (production, DBA, CI...).
--
-- Conventions respectées :
--   * la clé primaire de `utilisateurs` est `email` (VARCHAR 190) ;
--   * les clés étrangères suivent les changements d'adresse (ON UPDATE CASCADE)
--     et suppriment les données liées quand un compte disparaît (ON DELETE CASCADE) ;
--   * les messages ne sont jamais supprimés physiquement depuis l'interface :
--     `is_deleted` permet de conserver l'historique et la pagination.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pair_key CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_conversations_pair (pair_key),
  INDEX idx_conversations_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_email VARCHAR(190) NOT NULL,
  last_read_at DATETIME NULL,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_conversation_participants (conversation_id, user_email),
  INDEX idx_conversation_participants_user (user_email),
  CONSTRAINT fk_conversation_participants_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_conversation_participants_user
    FOREIGN KEY (user_email) REFERENCES utilisateurs(email) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id VARCHAR(190) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_messages_conversation (conversation_id, id),
  INDEX idx_messages_sender (sender_id),
  CONSTRAINT fk_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_messages_sender
    FOREIGN KEY (sender_id) REFERENCES utilisateurs(email) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
