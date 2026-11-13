CREATE TABLE IF NOT EXISTS objectifs (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  arbres INT UNSIGNED NOT NULL DEFAULT 0,
  survie_cible INT UNSIGNED NOT NULL DEFAULT 0,
  dechets DECIMAL(10, 2) NOT NULL DEFAULT 0,
  citoyens_sensibilises INT UNSIGNED NOT NULL DEFAULT 0,
  participants_actifs INT UNSIGNED NOT NULL DEFAULT 0,
  modifie_par VARCHAR(150) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS interventions (
  id VARCHAR(20) NOT NULL PRIMARY KEY,
  titre VARCHAR(255) NOT NULL,
  description TEXT NULL,
  pilier VARCHAR(50) NOT NULL,
  quartier VARCHAR(150) NOT NULL,
  `date` DATE NOT NULL,
  responsable VARCHAR(150) NULL,
  statut VARCHAR(50) NOT NULL DEFAULT 'planifiee',
  objectifs JSON NULL,
  realisations JSON NULL,
  coord JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_interventions_pilier (pilier),
  INDEX idx_interventions_statut (statut),
  INDEX idx_interventions_date (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plantations (
  id VARCHAR(20) NOT NULL PRIMARY KEY,
  site VARCHAR(255) NOT NULL,
  espece VARCHAR(255) NULL,
  arbres_plantes INT UNSIGNED NOT NULL DEFAULT 0,
  arbres_survivants INT UNSIGNED NOT NULL DEFAULT 0,
  arbres_non_survivants INT UNSIGNED NOT NULL DEFAULT 0,
  date_plantation DATE NULL,
  responsable VARCHAR(150) NULL,
  entretien VARCHAR(50) NOT NULL DEFAULT 'a_faire',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS arbres (
  id VARCHAR(20) NOT NULL PRIMARY KEY,
  code VARCHAR(255) NOT NULL,
  espece VARCHAR(150) NOT NULL,
  nom_scientifique VARCHAR(200) NULL,
  site VARCHAR(255) NULL,
  quartier VARCHAR(150) NULL,
  adresse VARCHAR(255) NULL,
  coord JSON NULL,
  date_plantation DATE NULL,
  hauteur DECIMAL(6, 2) NULL,
  diametre_tronc INT UNSIGNED NULL,
  etat VARCHAR(50) NULL,
  entretien VARCHAR(50) NULL,
  responsable VARCHAR(150) NULL,
  dernier_entretien DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_arbres_code (code),
  INDEX idx_arbres_quartier (quartier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipes (
  id VARCHAR(20) NOT NULL PRIMARY KEY,
  nom VARCHAR(200) NOT NULL,
  description TEXT NULL,
  zone VARCHAR(150) NULL,
  responsable VARCHAR(150) NULL,
  membres INT UNSIGNED NOT NULL DEFAULT 0,
  activites_attribuees INT UNSIGNED NOT NULL DEFAULT 0,
  statut VARCHAR(50) NOT NULL DEFAULT 'en_preparation',
  code_invitation VARCHAR(20) NOT NULL,
  code_invitation_actif TINYINT(1) NOT NULL DEFAULT 1,
  code_invitation_expire_le DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_equipes_code_invitation (code_invitation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paramètres institutionnels du programme NAATAL DAKAR.
-- Ligne unique (id = 1) : l'administrateur peut tout modifier.
CREATE TABLE IF NOT EXISTS parametres_programme (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  nom VARCHAR(150) NOT NULL DEFAULT 'NAATAL DAKAR',
  sigle VARCHAR(30) NOT NULL DEFAULT 'DPDD',
  coordination VARCHAR(255) NOT NULL DEFAULT '',
  initiative VARCHAR(150) NOT NULL DEFAULT '',
  description TEXT NULL,
  modifie_par VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Paramètres institutionnels de la campagne NAATAL DAKAR.
-- Ligne unique (id = 1) : c'est l'administrateur qui fixe le début et la fin.
CREATE TABLE IF NOT EXISTS parametres_campagne (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  nom VARCHAR(255) NOT NULL DEFAULT 'NAATAL DAKAR',
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  modifie_par VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campagnes (
  id VARCHAR(20) NOT NULL PRIMARY KEY,
  nom VARCHAR(255) NOT NULL,
  type VARCHAR(100) NULL,
  public_cible VARCHAR(255) NULL,
  participants INT UNSIGNED NOT NULL DEFAULT 0,
  date_debut DATE NULL,
  date_fin DATE NULL,
  statut VARCHAR(50) NOT NULL DEFAULT 'planifiee',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un compte unique par personne : l'adresse email est la clé primaire.
-- Elle sert également d'identifiant de session et de référence aux adhésions.
CREATE TABLE IF NOT EXISTS utilisateurs (
  email VARCHAR(190) NOT NULL PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  telephone VARCHAR(30) NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'agent',
  permissions JSON NULL,
  actif TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  derniere_connexion DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_utilisateurs_role (role),
  INDEX idx_utilisateurs_actif (actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Adhésions des comptes utilisateurs aux équipes.
-- L'email référence directement la clé primaire de `utilisateurs` et suit
-- automatiquement les changements d'adresse. La contrainte d'unicité empêche
-- un utilisateur de rejoindre deux fois la même équipe.
CREATE TABLE IF NOT EXISTS membres_equipes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  equipe_id VARCHAR(20) NOT NULL,
  utilisateur_email VARCHAR(190) NOT NULL,
  role_membre VARCHAR(50) NOT NULL DEFAULT 'membre',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_membres_equipes (equipe_id, utilisateur_email),
  INDEX idx_membres_equipes_utilisateur (utilisateur_email),
  CONSTRAINT fk_membres_equipes_equipe FOREIGN KEY (equipe_id) REFERENCES equipes(id) ON DELETE CASCADE,
  CONSTRAINT fk_membres_equipes_utilisateur FOREIGN KEY (utilisateur_email) REFERENCES utilisateurs(email) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Messagerie privée entre utilisateurs
-- ---------------------------------------------------------------------------
-- Une conversation privée réunit exactement deux comptes. `pair_key` est une
-- empreinte SHA-256 des deux emails triés : elle garantit qu'une même paire
-- d'utilisateurs ne peut pas avoir deux conversations, même en cas de clics
-- simultanés. Les participants sont aussi stockés dans
-- `conversation_participants` pour les accusés de lecture et l'évolution future
-- vers des conversations de groupe.
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

-- Les messages sont toujours persistés dans MySQL avant d'être diffusés par
-- Socket.IO. La suppression est logique (`is_deleted`) afin de conserver
-- l'historique et de notifier l'interlocuteur sans casser la pagination.
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
