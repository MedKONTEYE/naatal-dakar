const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

let pool = null;

const getConfig = () => ({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'naatal_dakar',
  charset: 'utf8mb4_unicode_ci',
  dateStrings: true
});

const getPool = () => {
  if (!pool) {
    throw new Error('Base de données non initialisée. Appelez connectDB() au démarrage.');
  }
  return pool;
};

const initSchema = async () => {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Le schéma contient plusieurs instructions SQL. On utilise une connexion
  // dédiée à l'initialisation : le pool applicatif reste sans multipleStatements.
  const migration = await mysql.createConnection({
    ...getConfig(),
    multipleStatements: true
  });
  try {
    await migration.query(schema);
  } finally {
    await migration.end();
  }
};

const quoteIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;

const getTableColumns = async (table) => {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${quoteIdentifier(table)}`);
  return new Map(rows.map((row) => [row.Field, row]));
};

const getPrimaryKeyColumns = async (table) => {
  const [rows] = await pool.query(
    `SHOW KEYS FROM ${quoteIdentifier(table)} WHERE Key_name = 'PRIMARY'`
  );
  return rows
    .sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index))
    .map((row) => row.Column_name);
};

const dropForeignKeyIfExists = async (table, constraintName) => {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL
     LIMIT 1`,
    [table, constraintName]
  );
  if (rows.length > 0) {
    await pool.query(
      `ALTER TABLE ${quoteIdentifier(table)} DROP FOREIGN KEY ${quoteIdentifier(constraintName)}`
    );
  }
};

const dropIndexIfExists = async (table, indexName) => {
  const [rows] = await pool.query(
    `SHOW INDEX FROM ${quoteIdentifier(table)} WHERE Key_name = ?`,
    [indexName]
  );
  if (rows.length > 0) {
    await pool.query(
      `ALTER TABLE ${quoteIdentifier(table)} DROP INDEX ${quoteIdentifier(indexName)}`
    );
  }
};

// Cette migration transforme l'ancien identifiant numérique en clé primaire
// email. Elle est idempotente et conserve les adhésions existantes.
const migrateUsersToEmailPrimaryKey = async () => {
  const userColumns = await getTableColumns('utilisateurs');
  const memberColumns = await getTableColumns('membres_equipes');
  const primaryKey = await getPrimaryKeyColumns('utilisateurs');
  const emailIsPrimary = primaryKey.length === 1 && primaryKey[0] === 'email';
  const hasLegacyUserId = userColumns.has('id');
  const hasLegacyMemberId = memberColumns.has('utilisateur_id');
  const hasMemberEmail = memberColumns.has('utilisateur_email');

  // Migration des adhésions avant de retirer l'ancienne clé numérique.
  if (hasLegacyMemberId) {
    if (!hasMemberEmail) {
      await pool.query(
        'ALTER TABLE membres_equipes ADD COLUMN utilisateur_email VARCHAR(190) NULL AFTER equipe_id'
      );
    }
    await pool.query(
      `UPDATE membres_equipes me
       JOIN utilisateurs u ON u.id = me.utilisateur_id
       SET me.utilisateur_email = u.email
       WHERE me.utilisateur_email IS NULL OR me.utilisateur_email = ''`
    );
    const [[missing]] = await pool.query(
      `SELECT COUNT(*) AS total FROM membres_equipes
       WHERE utilisateur_email IS NULL OR utilisateur_email = ''`
    );
    if (Number(missing.total) > 0) {
      throw new Error(
        'Migration email impossible : certaines adhésions ne correspondent à aucun utilisateur.'
      );
    }
    await dropForeignKeyIfExists('membres_equipes', 'fk_membres_equipes_utilisateur');
    await dropIndexIfExists('membres_equipes', 'idx_membres_equipes_utilisateur');
    // L'index unique historique commence par equipe_id et sert aussi à la clé
    // étrangère vers `equipes`. On le remplace temporairement pour ne pas
    // laisser cette contrainte sans index pendant la migration.
    await dropIndexIfExists('membres_equipes', 'idx_membres_equipes_equipe');
    await pool.query(
      'ALTER TABLE membres_equipes ADD INDEX idx_membres_equipes_equipe (equipe_id)'
    );
    await dropIndexIfExists('membres_equipes', 'uk_membres_equipes');
    await pool.query('ALTER TABLE membres_equipes DROP COLUMN utilisateur_id');
  }

  if (!hasMemberEmail && !hasLegacyMemberId) {
    await pool.query(
      'ALTER TABLE membres_equipes ADD COLUMN utilisateur_email VARCHAR(190) NULL AFTER equipe_id'
    );
  }

  if (!emailIsPrimary || hasLegacyUserId) {
    const emailColumn = userColumns.get('email');
    if (!emailColumn) {
      throw new Error('Migration email impossible : la colonne utilisateurs.email est absente.');
    }
    if (String(emailColumn.Null).toUpperCase() === 'YES') {
      const [[emptyEmails]] = await pool.query(
        "SELECT COUNT(*) AS total FROM utilisateurs WHERE email IS NULL OR email = ''"
      );
      if (Number(emptyEmails.total) > 0) {
        throw new Error('Migration email impossible : certains comptes n’ont pas d’adresse email.');
      }
      await pool.query('ALTER TABLE utilisateurs MODIFY email VARCHAR(190) NOT NULL');
    }

    const [duplicates] = await pool.query(
      `SELECT email, COUNT(*) AS total
       FROM utilisateurs
       GROUP BY email
       HAVING total > 1
       LIMIT 1`
    );
    if (duplicates.length > 0) {
      throw new Error(
        `Migration email impossible : l’adresse ${duplicates[0].email} est utilisée par plusieurs comptes.`
      );
    }

    // Retire les éventuelles clés étrangères qui pointeraient encore vers
    // l'ancien identifiant numérique.
    const [references] = await pool.query(
      `SELECT TABLE_NAME, CONSTRAINT_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME = 'utilisateurs'
         AND REFERENCED_COLUMN_NAME = 'id'`
    );
    for (const reference of references) {
      await dropForeignKeyIfExists(reference.TABLE_NAME, reference.CONSTRAINT_NAME);
    }

    const idColumn = userColumns.get('id');
    if (idColumn && /auto_increment/i.test(String(idColumn.Extra || ''))) {
      await pool.query('ALTER TABLE utilisateurs MODIFY id INT UNSIGNED NOT NULL');
    }

    await dropIndexIfExists('utilisateurs', 'uk_utilisateurs_email');

    if (!emailIsPrimary) {
      await pool.query('ALTER TABLE utilisateurs DROP PRIMARY KEY, ADD PRIMARY KEY (email)');
    }

    if (hasLegacyUserId) {
      await pool.query('ALTER TABLE utilisateurs DROP COLUMN id');
    }
  }

  await pool.query(
    'ALTER TABLE membres_equipes MODIFY utilisateur_email VARCHAR(190) NOT NULL'
  );

  const [memberIndexes] = await pool.query('SHOW INDEX FROM membres_equipes');
  const groupedIndexes = new Map();
  for (const row of memberIndexes) {
    if (!groupedIndexes.has(row.Key_name)) groupedIndexes.set(row.Key_name, []);
    groupedIndexes.get(row.Key_name).push(row);
  }
  const indexColumns = (rows) => rows
    .sort((a, b) => Number(a.Seq_in_index) - Number(b.Seq_in_index))
    .map((row) => row.Column_name);

  const hasUniqueMembership = [...groupedIndexes.values()].some((rows) => {
    const columns = indexColumns(rows);
    return Number(rows[0].Non_unique) === 0
      && columns.length === 2
      && columns[0] === 'equipe_id'
      && columns[1] === 'utilisateur_email';
  });
  if (!hasUniqueMembership) {
    await dropIndexIfExists('membres_equipes', 'uk_membres_equipes');
    await pool.query(
      'ALTER TABLE membres_equipes ADD UNIQUE KEY uk_membres_equipes (equipe_id, utilisateur_email)'
    );
  }
  await dropIndexIfExists('membres_equipes', 'idx_membres_equipes_equipe');

  const hasUserEmailIndex = memberIndexes.some(
    (row) => row.Column_name === 'utilisateur_email' && Number(row.Seq_in_index) === 1
  );
  if (!hasUserEmailIndex) {
    await pool.query(
      'ALTER TABLE membres_equipes ADD INDEX idx_membres_equipes_utilisateur (utilisateur_email)'
    );
  }

  const [membershipForeignKey] = await pool.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'membres_equipes'
       AND COLUMN_NAME = 'utilisateur_email'
       AND REFERENCED_TABLE_NAME = 'utilisateurs'
       AND REFERENCED_COLUMN_NAME = 'email'
     LIMIT 1`
  );
  if (membershipForeignKey.length === 0) {
    await dropForeignKeyIfExists('membres_equipes', 'fk_membres_equipes_utilisateur');
    await pool.query(
      `ALTER TABLE membres_equipes
       ADD CONSTRAINT fk_membres_equipes_utilisateur
       FOREIGN KEY (utilisateur_email) REFERENCES utilisateurs(email)
       ON DELETE CASCADE ON UPDATE CASCADE`
    );
  }
};

const ensureMigrations = async () => {
  // Migration idempotente pour les bases créées avant l'ajout de token_version.
  const [columns] = await pool.query(
    "SHOW COLUMNS FROM utilisateurs LIKE 'token_version'"
  );
  if (columns.length === 0) {
    await pool.query(
      'ALTER TABLE utilisateurs ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER actif'
    );
  }

  const ensureColumn = async (column, definition) => {
    const [existing] = await pool.query('SHOW COLUMNS FROM utilisateurs LIKE ?', [column]);
    if (existing.length === 0) {
      await pool.query(`ALTER TABLE utilisateurs ADD COLUMN ${definition}`);
    }
  };

  const ensureColumnOn = async (table, column, definition) => {
    const [existing] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    if (existing.length === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
    }
  };

  // Gestion complète des utilisateurs (téléphone, permissions supplémentaires).
  await ensureColumn('telephone', 'telephone VARCHAR(30) NULL AFTER email');
  await ensureColumn('permissions', 'permissions JSON NULL AFTER role');

  // L'email devient la clé primaire unique des comptes utilisateurs.
  await migrateUsersToEmailPrimaryKey();

  // Traçabilité des modifications des objectifs prévisionnels.
  await ensureColumnOn('objectifs', 'modifie_par', 'modifie_par VARCHAR(150) NULL AFTER participants_actifs');
  await ensureColumnOn(
    'objectifs',
    'updated_at',
    'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER modifie_par'
  );

  // Gestion des équipes : description et état de la clé d'invitation.
  await ensureColumnOn('equipes', 'description', 'description TEXT NULL AFTER nom');
  await ensureColumnOn(
    'equipes',
    'code_invitation',
    'code_invitation VARCHAR(20) NULL AFTER statut'
  );
  await ensureColumnOn(
    'equipes',
    'code_invitation_actif',
    'code_invitation_actif TINYINT(1) NOT NULL DEFAULT 1 AFTER code_invitation'
  );
  await ensureColumnOn(
    'equipes',
    'code_invitation_expire_le',
    'code_invitation_expire_le DATETIME NULL AFTER code_invitation_actif'
  );

  const { generateUniqueTeamCode } = require('../utils/invitationCode');
  const [teamsWithoutCode] = await pool.query(
    "SELECT id FROM equipes WHERE code_invitation IS NULL OR code_invitation = ''"
  );
  for (const team of teamsWithoutCode) {
    const code = await generateUniqueTeamCode(pool);
    await pool.query('UPDATE equipes SET code_invitation = ? WHERE id = ?', [code, team.id]);
  }

  const [codeColumns] = await pool.query("SHOW COLUMNS FROM equipes LIKE 'code_invitation'");
  if (codeColumns.length > 0 && codeColumns[0].Null === 'YES') {
    await pool.query('ALTER TABLE equipes MODIFY code_invitation VARCHAR(20) NOT NULL');
  }

  const [codeIndexes] = await pool.query(
    "SHOW INDEX FROM equipes WHERE Key_name = 'uk_equipes_code_invitation'"
  );
  if (codeIndexes.length === 0) {
    await pool.query(
      'ALTER TABLE equipes ADD UNIQUE KEY uk_equipes_code_invitation (code_invitation)'
    );
  }

  // Migration des anciens libellés de rôles.
  await pool.query("UPDATE utilisateurs SET role = 'gestionnaire' WHERE role = 'coordinateur'");

  // Le compte administrateur historique devient super administrateur
  // s'il n'existe encore aucun compte de ce niveau.
  const [superAdmins] = await pool.query(
    "SELECT COUNT(*) AS total FROM utilisateurs WHERE role = 'super_admin'"
  );
  if (Number(superAdmins[0].total) === 0) {
    await pool.query(
      "UPDATE utilisateurs SET role = 'super_admin' WHERE role = 'administrateur' ORDER BY created_at ASC, email ASC LIMIT 1"
    );
  }
};

const connectDB = async () => {
  const config = getConfig();
  const { database, ...serverConfig } = config;

  // Crée la base si elle n'existe pas encore (connexion sans base sélectionnée).
  const bootstrap = await mysql.createConnection(serverConfig);
  try {
    const safeDatabase = database.replace(/`/g, '``');
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${safeDatabase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await bootstrap.end();
  }

  pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0
  });

  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }

  await initSchema();
  await ensureMigrations();

  // Garantit l'existence des paramètres de campagne (ligne unique).
  // La période par défaut ne s'applique qu'à la toute première initialisation ;
  // ensuite, seules les valeurs choisies par l'administrateur font foi.
  const { getCampagne } = require('../utils/campagne');
  await getCampagne(pool);

  // Informations du programme et objectifs prévisionnels (lignes uniques).
  const { ensureParametres } = require('../utils/parametres');
  await ensureParametres(pool);

  if (String(process.env.DB_AUTO_SEED || 'true').toLowerCase() !== 'false') {
    const { seedDatabase } = require('./seed');
    const seeded = await seedDatabase(pool);
    if (seeded) {
      console.log('🌱 Données de démonstration insérées dans MySQL.');
    }
  }

  console.log(`✅ MySQL connecté: ${config.host}:${config.port}/${config.database}`);
  return pool;
};

const parseJson = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const closeDB = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

module.exports = {
  connectDB,
  getPool,
  parseJson,
  closeDB
};
