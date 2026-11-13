const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.DB_AUTO_SEED = 'false';

const { connectDB, getPool, closeDB } = require('./db');
const { email: validateEmail, password: validatePassword } = require('../utils/validation');

const BCRYPT_ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));

const readArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
};

const run = async () => {
  const rawEmail = readArg('email', process.env.ADMIN_EMAIL || 'admin@naatal.dakar');
  const rawPassword = readArg('password', process.env.ADMIN_PASSWORD || '');
  const nom = String(readArg('nom', process.env.ADMIN_NAME || 'Administrateur NAATAL')).trim();

  let email;
  let password;
  try {
    email = validateEmail(rawEmail);
    if (!nom || nom.length > 150) throw new Error('Nom invalide (150 caractères maximum)');
    password = validatePassword(rawPassword, { field: 'ADMIN_PASSWORD' });
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    await connectDB();
    const pool = getPool();
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [rows] = await pool.query('SELECT 1 FROM utilisateurs WHERE email = ? LIMIT 1', [email]);
    if (rows.length > 0) {
      await pool.query(
        `UPDATE utilisateurs
         SET nom = ?, mot_de_passe = ?, role = 'super_admin', actif = 1,
             token_version = token_version + 1
         WHERE email = ?`,
        [nom, hash, email]
      );
      console.log(`✅ Compte administrateur mis à jour : ${email}`);
    } else {
      await pool.query(
        `INSERT INTO utilisateurs (nom, email, mot_de_passe, role, actif)
         VALUES (?, ?, ?, 'super_admin', 1)`,
        [nom, email, hash]
      );
      console.log(`✅ Compte administrateur créé : ${email}`);
    }
    console.log('   Le mot de passe saisi n’est jamais affiché dans les journaux.');
  } catch (error) {
    console.error('❌ Création du compte administrateur impossible :', error.message);
    process.exitCode = 1;
  } finally {
    await closeDB();
  }
};

run();
