const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
const { mapUser } = require('../middleware/auth');
const {
  getJwtSecret,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_ALGORITHM
} = require('../config/security');
const {
  email: validateEmail,
  password: validatePassword,
  telephone: validateTelephone,
  text
} = require('../utils/validation');
const { refreshPairKeysForUser } = require('../utils/conversations');
const { disconnectUser } = require('../realtime/socket');

const BCRYPT_ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));
const DUMMY_HASH = '$2b$12$57rlUFdQ.0g4MpyeA4pbaeCafvlbdsbkaLCXWlHRfKRJ3UplyDThq';
const INVALID_CREDENTIALS = 'Email ou mot de passe incorrect';

const signToken = (user, tokenVersion = 0) => jwt.sign(
  { sub: String(user.email), role: user.role, ver: Number(tokenVersion) || 0 },
  getJwtSecret(),
  {
    algorithm: JWT_ALGORITHM,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  }
);

const login = async (req, res, next) => {
  try {
    const rawEmail = typeof req.body.email === 'string' ? req.body.email : '';
    const rawPassword = typeof req.body.password === 'string' ? req.body.password : '';

    if (!rawEmail || !rawPassword) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }

    let email;
    try {
      email = validateEmail(rawEmail);
    } catch (error) {
      await bcrypt.compare(rawPassword.slice(0, 72), DUMMY_HASH);
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    if (Buffer.byteLength(rawPassword, 'utf8') > 72) {
      await bcrypt.compare(rawPassword.slice(0, 72), DUMMY_HASH);
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    const [rows] = await getPool().query(
      `SELECT email, nom, telephone, mot_de_passe, role, actif, permissions,
              token_version AS tokenVersion, derniere_connexion AS derniereConnexion
       FROM utilisateurs WHERE email = ? LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      await bcrypt.compare(rawPassword, DUMMY_HASH);
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    const user = rows[0];
    const passwordOk = await bcrypt.compare(rawPassword, user.mot_de_passe);
    if (!passwordOk) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    if (!user.actif) {
      return res.status(401).json({ success: false, message: INVALID_CREDENTIALS });
    }

    await getPool().query('UPDATE utilisateurs SET derniere_connexion = NOW() WHERE email = ?', [user.email]);

    const safeUser = mapUser({ ...user, derniereConnexion: new Date().toISOString() });
    return res.json({
      success: true,
      token: signToken(safeUser, user.tokenVersion),
      user: safeUser
    });
  } catch (error) {
    return next(error);
  }
};

const me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// Inscription publique : crée toujours un compte au rôle le plus bas
// (« utilisateur »), sans possibilité d'élévation de privilèges.
const register = async (req, res, next) => {
  try {
    const nom = text(req.body.nom, { field: 'Nom', min: 2, max: 150, required: true });
    const email = validateEmail(req.body.email);
    const telephone = validateTelephone(req.body.telephone);
    const motDePasse = validatePassword(req.body.password, { field: 'Mot de passe' });
    const confirmation = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

    if (motDePasse !== confirmation) {
      return res.status(400).json({ success: false, message: 'Les mots de passe ne correspondent pas' });
    }

    const [existing] = await getPool().query(
      'SELECT 1 FROM utilisateurs WHERE email = ? LIMIT 1',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Un compte existe déjà avec cet email' });
    }

    const hash = await bcrypt.hash(motDePasse, BCRYPT_ROUNDS);

    try {
      await getPool().query(
        `INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe, role, actif, permissions)
         VALUES (?, ?, ?, ?, 'utilisateur', 1, ?)`,
        [nom, email, telephone, hash, JSON.stringify([])]
      );
    } catch (error) {
      if (error && error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Un compte existe déjà avec cet email' });
      }
      throw error;
    }

    const [rows] = await getPool().query(
      `SELECT email, nom, telephone, role, actif, permissions,
              token_version AS tokenVersion, derniere_connexion AS derniereConnexion
       FROM utilisateurs WHERE email = ? LIMIT 1`,
      [email]
    );

    const safeUser = mapUser(rows[0]);
    return res.status(201).json({
      success: true,
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      user: safeUser
    });
  } catch (error) {
    return next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'Mot de passe actuel requis' });
    }
    if (Buffer.byteLength(currentPassword, 'utf8') > 72) {
      return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect' });
    }

    const newPassword = validatePassword(req.body.newPassword, { field: 'Le nouveau mot de passe' });

    const [rows] = await getPool().query(
      'SELECT mot_de_passe FROM utilisateurs WHERE email = ? LIMIT 1',
      [req.user.email]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Compte introuvable' });
    }

    const passwordOk = await bcrypt.compare(currentPassword, rows[0].mot_de_passe);
    if (!passwordOk) {
      return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect' });
    }

    const samePassword = await bcrypt.compare(newPassword, rows[0].mot_de_passe);
    if (samePassword) {
      return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit être différent de l’ancien' });
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await getPool().query(
      'UPDATE utilisateurs SET mot_de_passe = ?, token_version = token_version + 1 WHERE email = ?',
      [hash, req.user.email]
    );

    // Les autres sessions sont révoquées ; la session courante reçoit un
    // nouveau jeton pour rester connectée sans ressaisir le mot de passe.
    const [updated] = await getPool().query(
      `SELECT email, nom, telephone, role, actif, permissions,
              token_version AS tokenVersion, derniere_connexion AS derniereConnexion
       FROM utilisateurs WHERE email = ? LIMIT 1`,
      [req.user.email]
    );
    const safeUser = mapUser(updated[0]);

    return res.json({
      success: true,
      message: 'Mot de passe mis à jour. Les autres sessions ont été déconnectées.',
      token: signToken(safeUser, updated[0].tokenVersion),
      user: safeUser
    });
  } catch (error) {
    return next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const nom = text(req.body.nom, { field: 'Nom', min: 2, max: 150, required: true });
    const email = validateEmail(req.body.email);
    const telephone = validateTelephone(req.body.telephone);

    const emailChanged = email !== req.user.email;
    const pool = getPool();

    if (emailChanged) {
      const [existing] = await pool.query(
        'SELECT email FROM utilisateurs WHERE email = ? LIMIT 1',
        [email]
      );
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'Cet email est déjà utilisé' });
      }
    }

    await pool.query(
      `UPDATE utilisateurs
       SET nom = ?, email = ?, telephone = ?, token_version = token_version + ?
       WHERE email = ?`,
      [nom, email, telephone, emailChanged ? 1 : 0, req.user.email]
    );

    if (emailChanged) {
      await refreshPairKeysForUser(pool, email);
      disconnectUser(req.user.email);
    }

    const [rows] = await pool.query(
      `SELECT email, nom, telephone, role, actif, permissions,
              token_version AS tokenVersion, derniere_connexion AS derniereConnexion
       FROM utilisateurs WHERE email = ? LIMIT 1`,
      [email]
    );
    const updated = rows[0];
    const safeUser = mapUser(updated);

    const response = {
      success: true,
      message: 'Profil mis à jour',
      user: safeUser
    };

    if (emailChanged) {
      // L'email est la clé primaire et l'identifiant du jeton : on renvoie
      // immédiatement un jeton valide pour éviter toute déconnexion brutale.
      response.token = signToken(safeUser, updated.tokenVersion);
      response.message = 'Profil mis à jour. Votre adresse email de connexion a changé.';
    }

    res.json(response);
  } catch (error) {
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await getPool().query(
      'UPDATE utilisateurs SET token_version = token_version + 1 WHERE email = ?',
      [req.user.email]
    );
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  me,
  changePassword,
  updateProfile,
  logout,
  signToken,
  BCRYPT_ROUNDS
};
