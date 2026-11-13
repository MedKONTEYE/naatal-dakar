const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getPool } = require('../config/db');
const {
  ROLES,
  ALL_PERMISSIONS,
  canManageTarget,
  canAssignRole,
  effectivePermissions,
  normalizeOverrides
} = require('../config/roles');
const {
  email: validateEmail,
  password: validatePassword,
  text,
  telephone: validateTelephone,
  oneOf,
  integer,
  booleanFlag,
  ValidationError
} = require('../utils/validation');
const { signToken } = require('./authController');
const { refreshPairKeysForUser, cleanupOrphanConversations } = require('../utils/conversations');
const { disconnectUser } = require('../realtime/socket');

const BCRYPT_ROUNDS = Math.min(15, Math.max(10, Number(process.env.BCRYPT_ROUNDS) || 12));

const USER_COLUMNS = `email, nom, telephone, role, actif, permissions,
  token_version AS tokenVersion, derniere_connexion AS derniereConnexion,
  created_at AS createdAt, updated_at AS updatedAt`;

const parseOverrides = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return normalizeOverrides(value);
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return normalizeOverrides(parsed);
  } catch (error) {
    return [];
  }
};

const serializeUser = (row) => {
  const overrides = parseOverrides(row.permissions);
  return {
    nom: row.nom,
    email: row.email,
    telephone: row.telephone || '',
    role: row.role,
    actif: Boolean(row.actif),
    permissions: effectivePermissions(row.role, overrides),
    permissionsSupplementaires: overrides,
    derniereConnexion: row.derniereConnexion || null,
    createdAt: row.createdAt || null
  };
};

const fail = (res, status, message) => res.status(status).json({ success: false, message });

const readEmail = (value) => validateEmail(value, { field: 'Email de l’utilisateur' });

const escapeLike = (value) => value.replace(/[\\%_]/g, '\\$&');

const generatePassword = () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `Nt1!${crypto.randomBytes(18).toString('base64url')}`;
    try {
      return validatePassword(candidate, { field: 'Mot de passe généré' });
    } catch (error) {
      // Nouvelle tentative si la génération ne respecte pas la politique.
    }
  }
  throw new Error('Génération de mot de passe impossible');
};

const findUser = async (email) => {
  const [rows] = await getPool().query(
    `SELECT ${USER_COLUMNS} FROM utilisateurs WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
};

const countSuperAdmins = async ({ onlyActive = false } = {}) => {
  const [rows] = await getPool().query(
    `SELECT COUNT(*) AS total FROM utilisateurs WHERE role = 'super_admin'${onlyActive ? ' AND actif = 1' : ''}`
  );
  return Number(rows[0].total);
};

// Un administrateur ne peut pas s'attribuer un rôle supérieur au sien,
// ni créer un compte super administrateur en modifiant la requête.
const validateRoleChange = (req, res, target, nextRole) => {
  if (nextRole === target.role) return true;
  if (target.email === req.user.email) {
    fail(res, 400, 'Vous ne pouvez pas modifier votre propre rôle');
    return false;
  }
  if (!canAssignRole(req.user, nextRole)) {
    fail(res, 403, 'Vous ne pouvez pas attribuer ce rôle');
    return false;
  }
  return true;
};

const validateStatusChange = async (req, res, target, nextActif) => {
  if (nextActif === Boolean(target.actif)) return true;
  if (target.email === req.user.email) {
    fail(res, 400, 'Vous ne pouvez pas désactiver votre propre compte');
    return false;
  }
  if (!nextActif && target.role === 'super_admin' && (await countSuperAdmins({ onlyActive: true })) <= 1) {
    fail(res, 400, 'Le dernier super administrateur actif ne peut pas être désactivé');
    return false;
  }
  return true;
};

const readOverrides = (req, rawValue, role) => {
  if (rawValue === undefined) return { ok: true, value: [] };
  if (!Array.isArray(rawValue)) {
    throw new ValidationError('Les permissions doivent être une liste');
  }
  if (role === 'super_admin') {
    return { ok: true, value: [] };
  }
  if (rawValue.length > 0 && req.user.role !== 'super_admin') {
    return { ok: false, message: 'Seul un super administrateur peut accorder des permissions supplémentaires' };
  }
  const invalid = rawValue.find((item) => typeof item !== 'string' || !ALL_PERMISSIONS.includes(item));
  if (invalid !== undefined) {
    throw new ValidationError('Permission inconnue');
  }
  return { ok: true, value: normalizeOverrides(rawValue) };
};

// GET /api/users
const listUsers = async (req, res, next) => {
  try {
    const search = text(req.query.q, { field: 'Recherche', min: 0, max: 100, fallback: '' });
    const role = oneOf(req.query.role, ROLES, { field: 'Rôle', fallback: null });
    const statut = oneOf(req.query.statut, ['tous', 'actif', 'inactif'], {
      field: 'Statut',
      fallback: 'tous'
    });
    const page = integer(req.query.page, { field: 'Page', min: 1, max: 100000, fallback: 1 });
    const limit = integer(req.query.limit, { field: 'Limite', min: 1, max: 100, fallback: 20 });

    const conditions = [];
    const params = [];

    if (search) {
      const term = `%${escapeLike(search)}%`;
      conditions.push('(nom LIKE ? OR email LIKE ? OR telephone LIKE ?)');
      params.push(term, term, term);
    }
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    if (statut === 'actif') conditions.push('actif = 1');
    if (statut === 'inactif') conditions.push('actif = 0');

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pool = getPool();

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM utilisateurs ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT ${USER_COLUMNS} FROM utilisateurs ${whereSql}
       ORDER BY created_at DESC, email DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    );

    const [[statsRow]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(role IN ('super_admin', 'administrateur')), 0) AS administrateurs,
         COALESCE(SUM(role = 'gestionnaire'), 0) AS gestionnaires,
         COALESCE(SUM(role = 'agent'), 0) AS agents,
         COALESCE(SUM(role = 'utilisateur'), 0) AS utilisateurs,
         COALESCE(SUM(actif = 1), 0) AS actifs,
         COALESCE(SUM(actif = 0), 0) AS inactifs
       FROM utilisateurs`
    );

    const stats = Object.fromEntries(
      Object.entries(statsRow).map(([key, value]) => [key, Number(value)])
    );

    res.json({
      success: true,
      data: rows.map(serializeUser),
      total: Number(countRow.total),
      page,
      limit,
      stats
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/users/:email
const getUser = async (req, res, next) => {
  try {
    const email = readEmail(req.params.email);
    const user = await findUser(email);
    if (!user) return fail(res, 404, 'Utilisateur introuvable');
    return res.json({ success: true, user: serializeUser(user) });
  } catch (error) {
    return next(error);
  }
};

// POST /api/users
const createUser = async (req, res, next) => {
  try {
    const nom = text(req.body.nom, { field: 'Nom', min: 2, max: 150, required: true });
    const email = validateEmail(req.body.email);
    const telephone = validateTelephone(req.body.telephone);
    const role = oneOf(req.body.role, ROLES, { field: 'Rôle', required: true });
    const actif = booleanFlag(req.body.actif, { field: 'Statut', fallback: true });

    if (!canAssignRole(req.user, role)) {
      return fail(res, 403, 'Vous ne pouvez pas attribuer ce rôle');
    }

    const overrides = readOverrides(req, req.body.permissionsSupplementaires, role);
    if (!overrides.ok) return fail(res, 403, overrides.message);

    const [existing] = await getPool().query(
      'SELECT 1 FROM utilisateurs WHERE email = ? LIMIT 1',
      [email]
    );
    if (existing.length > 0) {
      return fail(res, 409, 'Cet email est déjà utilisé');
    }

    const mustGenerate = !req.body.password;
    const password = mustGenerate
      ? generatePassword()
      : validatePassword(req.body.password, { field: 'Mot de passe' });
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await getPool().query(
      `INSERT INTO utilisateurs (nom, email, telephone, mot_de_passe, role, actif, permissions)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nom, email, telephone, hash, role, actif ? 1 : 0, JSON.stringify(overrides.value)]
    );

    const created = await findUser(email);
    return res.status(201).json({
      success: true,
      message: 'Utilisateur créé',
      user: serializeUser(created),
      temporaryPassword: mustGenerate ? password : null
    });
  } catch (error) {
    return next(error);
  }
};

// PUT /api/users/:email
const updateUser = async (req, res, next) => {
  try {
    const currentEmail = readEmail(req.params.email);
    const target = await findUser(currentEmail);
    if (!target) return fail(res, 404, 'Utilisateur introuvable');
    if (!canManageTarget(req.user, target)) {
      return fail(res, 403, 'Vous ne pouvez pas modifier cet utilisateur');
    }

    const nom = text(req.body.nom !== undefined ? req.body.nom : target.nom, {
      field: 'Nom',
      min: 2,
      max: 150,
      required: true
    });
    const email = validateEmail(req.body.email !== undefined ? req.body.email : target.email);
    const telephone = req.body.telephone !== undefined
      ? validateTelephone(req.body.telephone)
      : (target.telephone || '');
    const role = req.body.role !== undefined
      ? oneOf(req.body.role, ROLES, { field: 'Rôle', required: true })
      : target.role;
    const actif = req.body.actif !== undefined
      ? booleanFlag(req.body.actif, { field: 'Statut' })
      : Boolean(target.actif);

    if (role !== target.role && !validateRoleChange(req, res, target, role)) return undefined;
    if (
      role !== target.role &&
      target.role === 'super_admin' &&
      role !== 'super_admin' &&
      (await countSuperAdmins()) <= 1
    ) {
      return fail(res, 400, 'Le dernier super administrateur ne peut pas être rétrogradé');
    }
    if (actif !== Boolean(target.actif) && !(await validateStatusChange(req, res, target, actif))) {
      return undefined;
    }

    const overrides = req.body.permissionsSupplementaires !== undefined
      ? readOverrides(req, req.body.permissionsSupplementaires, role)
      : { ok: true, value: role === 'super_admin' ? [] : parseOverrides(target.permissions) };
    if (!overrides.ok) return fail(res, 403, overrides.message);

    const [existing] = await getPool().query(
      'SELECT 1 FROM utilisateurs WHERE email = ? AND email <> ? LIMIT 1',
      [email, target.email]
    );
    if (existing.length > 0) {
      return fail(res, 409, 'Cet email est déjà utilisé');
    }

    const identityChanged =
      role !== target.role ||
      actif !== Boolean(target.actif) ||
      email !== target.email;
    await getPool().query(
      `UPDATE utilisateurs
       SET nom = ?, email = ?, telephone = ?, role = ?, actif = ?, permissions = ?,
           token_version = token_version + ?
       WHERE email = ?`,
      [
        nom,
        email,
        telephone,
        role,
        actif ? 1 : 0,
        JSON.stringify(overrides.value),
        identityChanged ? 1 : 0,
        target.email
      ]
    );

    if (email !== target.email) {
      await refreshPairKeysForUser(getPool(), email);
    }
    if (identityChanged) {
      disconnectUser(target.email);
    }

    const updated = await findUser(email);
    const serialized = serializeUser(updated);
    const response = {
      success: true,
      message: email !== target.email
        ? 'Utilisateur mis à jour. Son adresse email de connexion a changé.'
        : 'Utilisateur mis à jour',
      user: serialized
    };

    if (target.email === req.user.email && email !== target.email) {
      // La session en cours repose sur l'ancienne adresse (clé primaire) :
      // on renouvelle immédiatement le jeton de l'administrateur concerné.
      response.token = signToken(serialized, updated.tokenVersion);
      response.message = 'Utilisateur mis à jour. Votre session a été renouvelée avec la nouvelle adresse.';
    }

    return res.json(response);
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/users/:email/role
const changeRole = async (req, res, next) => {
  try {
    const email = readEmail(req.params.email);
    const target = await findUser(email);
    if (!target) return fail(res, 404, 'Utilisateur introuvable');
    if (!canManageTarget(req.user, target)) {
      return fail(res, 403, 'Vous ne pouvez pas modifier cet utilisateur');
    }

    const role = oneOf(req.body.role, ROLES, { field: 'Rôle', required: true });
    if (role === target.role) {
      return res.json({ success: true, message: 'Rôle inchangé', user: serializeUser(target) });
    }
    if (!validateRoleChange(req, res, target, role)) return undefined;

    if (target.role === 'super_admin' && role !== 'super_admin' && (await countSuperAdmins()) <= 1) {
      return fail(res, 400, 'Le dernier super administrateur ne peut pas être rétrogradé');
    }

    await getPool().query(
      'UPDATE utilisateurs SET role = ?, permissions = ?, token_version = token_version + 1 WHERE email = ?',
      [role, JSON.stringify(role === 'super_admin' ? [] : parseOverrides(target.permissions)), target.email]
    );

    const updated = await findUser(target.email);
    return res.json({ success: true, message: 'Rôle mis à jour', user: serializeUser(updated) });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/users/:email/status
const changeStatus = async (req, res, next) => {
  try {
    const email = readEmail(req.params.email);
    const target = await findUser(email);
    if (!target) return fail(res, 404, 'Utilisateur introuvable');
    if (!canManageTarget(req.user, target)) {
      return fail(res, 403, 'Vous ne pouvez pas modifier cet utilisateur');
    }

    const actif = booleanFlag(req.body.actif, { field: 'Statut', required: true });
    if (!(await validateStatusChange(req, res, target, actif))) return undefined;

    await getPool().query(
      'UPDATE utilisateurs SET actif = ?, token_version = token_version + 1 WHERE email = ?',
      [actif ? 1 : 0, target.email]
    );

    const updated = await findUser(target.email);
    return res.json({
      success: true,
      message: actif ? 'Compte activé' : 'Compte désactivé',
      user: serializeUser(updated)
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/users/:email/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const email = readEmail(req.params.email);
    const target = await findUser(email);
    if (!target) return fail(res, 404, 'Utilisateur introuvable');
    if (!canManageTarget(req.user, target)) {
      return fail(res, 403, 'Vous ne pouvez pas modifier cet utilisateur');
    }
    if (target.email === req.user.email) {
      return fail(res, 400, 'Utilisez la page Paramètres pour changer votre propre mot de passe');
    }

    const mustGenerate = !req.body.newPassword;
    const newPassword = mustGenerate
      ? generatePassword()
      : validatePassword(req.body.newPassword, { field: 'Nouveau mot de passe' });
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await getPool().query(
      'UPDATE utilisateurs SET mot_de_passe = ?, token_version = token_version + 1 WHERE email = ?',
      [hash, target.email]
    );

    return res.json({
      success: true,
      message: 'Mot de passe réinitialisé. Toutes les sessions de cet utilisateur ont été révoquées.',
      temporaryPassword: mustGenerate ? newPassword : null
    });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/users/:email
const deleteUser = async (req, res, next) => {
  try {
    const email = readEmail(req.params.email);
    const target = await findUser(email);
    if (!target) return fail(res, 404, 'Utilisateur introuvable');
    if (target.email === req.user.email) {
      return fail(res, 400, 'Vous ne pouvez pas supprimer votre propre compte');
    }
    if (!canManageTarget(req.user, target)) {
      return fail(res, 403, 'Vous ne pouvez pas supprimer cet utilisateur');
    }
    if (target.role === 'super_admin' && (await countSuperAdmins()) <= 1) {
      return fail(res, 400, 'Le dernier super administrateur ne peut pas être supprimé');
    }

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [memberships] = await connection.query(
        'SELECT equipe_id FROM membres_equipes WHERE utilisateur_email = ?',
        [target.email]
      );
      await connection.query('DELETE FROM utilisateurs WHERE email = ?', [target.email]);
      // La suppression du compte retire ses adhésions par cascade. Le compteur
      // d'affichage des équipes concernées doit suivre la même opération.
      for (const membership of memberships) {
        await connection.query(
          `UPDATE equipes
           SET membres = CASE WHEN membres > 0 THEN membres - 1 ELSE 0 END
           WHERE id = ?`,
          [membership.equipe_id]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // Les participants et messages du compte ont été retirés par cascade.
    // Les conversations qui ne réunissent plus deux comptes sont supprimées
    // pour ne jamais exposer un historique orphelin à un futur compte.
    try {
      await cleanupOrphanConversations(getPool());
    } catch (cleanupError) {
      console.error('Nettoyage des conversations orphelines impossible :', cleanupError.message);
    }
    disconnectUser(target.email);

    return res.json({ success: true, message: 'Utilisateur supprimé' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeRole,
  changeStatus,
  resetPassword,
  deleteUser
};
