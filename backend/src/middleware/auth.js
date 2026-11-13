const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
const { getJwtSecret, JWT_ISSUER, JWT_AUDIENCE, JWT_ALGORITHM } = require('../config/security');
const { effectivePermissions, hasPermission } = require('../config/roles');

const parsePermissions = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const mapUser = (row) => ({
  nom: row.nom,
  email: row.email,
  telephone: row.telephone || '',
  role: row.role,
  actif: Boolean(row.actif),
  permissions: effectivePermissions(row.role, parsePermissions(row.permissions)),
  derniereConnexion: row.derniereConnexion || null
});

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
};

const verifyToken = (token) => jwt.verify(token, getJwtSecret(), {
  algorithms: [JWT_ALGORITHM],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE
});

const requireAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentification requise' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session invalide ou expirée' });
  }

  const userEmail = typeof payload.sub === 'string' ? payload.sub.trim().toLowerCase() : '';
  if (!userEmail || userEmail.length > 190) {
    return res.status(401).json({ success: false, message: 'Session invalide ou expirée' });
  }

  try {
    const [rows] = await getPool().query(
      `SELECT email, nom, telephone, role, actif, permissions,
              token_version AS tokenVersion, derniere_connexion AS derniereConnexion
       FROM utilisateurs WHERE email = ? LIMIT 1`,
      [userEmail]
    );

    if (rows.length === 0 || !rows[0].actif) {
      return res.status(401).json({ success: false, message: 'Compte introuvable ou désactivé' });
    }

    if (Number(payload.ver) !== Number(rows[0].tokenVersion)) {
      return res.status(401).json({ success: false, message: 'Session invalide ou expirée' });
    }

    req.user = mapUser(rows[0]);
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentification requise' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Droits insuffisants pour cette action' });
  }
  return next();
};

// Vérifie une permission effective (rôle + éventuelles permissions supplémentaires).
// La permission est toujours recalculée depuis la base à chaque requête :
// modifier le jeton ou le corps de la requête côté navigateur ne donne aucun droit.
const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentification requise' });
  }
  const allowed = permissions.every((permission) => hasPermission(req.user.permissions, permission));
  if (!allowed) {
    return res.status(403).json({ success: false, message: 'Droits insuffisants pour cette action' });
  }
  return next();
};

const requireAdmin = requireRole('administrateur', 'super_admin');
const requireSuperAdmin = requireRole('super_admin');

module.exports = {
  requireAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireSuperAdmin,
  mapUser,
  verifyToken
};
