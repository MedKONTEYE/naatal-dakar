const { getPool } = require('../config/db');
const { hasPermission } = require('../config/roles');
const { rowToEquipe } = require('../utils/mappers');
const { generateUniqueTeamCode } = require('../utils/invitationCode');
const {
  text,
  integer,
  oneOf,
  email: validateEmail,
  booleanFlag,
  invitationCode: validateInvitationCode
} = require('../utils/validation');

const TEAM_STATUSES = ['en_preparation', 'mobilisee', 'terminee'];
const MEMBER_ROLES = ['membre', 'responsable'];

const TEAM_FIELDS = `e.id, e.nom, e.description, e.zone, e.responsable, e.membres,
  e.activites_attribuees AS activitesAttribuees, e.statut,
  e.code_invitation AS codeInvitation,
  e.code_invitation_actif AS codeInvitationActif,
  e.code_invitation_expire_le AS codeInvitationExpireLe,
  CASE WHEN e.code_invitation_expire_le IS NOT NULL
            AND e.code_invitation_expire_le <= NOW()
       THEN 1 ELSE 0 END AS codeInvitationExpire`;

const canManageTeams = (user) => hasPermission(user.permissions, 'teams.manage');

const serializeTeam = (row, { includeKey = false } = {}) => {
  const team = rowToEquipe(row);
  if (!includeKey) {
    delete team.codeInvitation;
    delete team.codeInvitationActif;
    delete team.codeInvitationExpireLe;
    delete team.codeInvitationExpire;
  }
  return team;
};

const readTeamId = (value) =>
  text(value, { field: 'Identifiant de l’équipe', min: 3, max: 20, required: true }).toUpperCase();

const findTeamById = async (teamId) => {
  const [rows] = await getPool().query(
    `SELECT ${TEAM_FIELDS} FROM equipes e WHERE e.id = ? LIMIT 1`,
    [teamId]
  );
  return rows[0] || null;
};

const findTeamByCode = async (code, userEmail) => {
  const [rows] = await getPool().query(
    `SELECT ${TEAM_FIELDS},
            mine.role_membre AS roleMembre,
            mine.joined_at AS joinedAt,
            (SELECT COUNT(*) FROM membres_equipes total WHERE total.equipe_id = e.id) AS membresInscrits
     FROM equipes e
     LEFT JOIN membres_equipes mine
       ON mine.equipe_id = e.id AND mine.utilisateur_email = ?
     WHERE e.code_invitation = ?
     LIMIT 1`,
    [userEmail, code]
  );
  return rows[0] || null;
};

const resolveInvitation = async (code, userEmail) => {
  const team = await findTeamByCode(code, userEmail);
  if (!team) {
    return {
      errorStatus: 404,
      message: 'Code d’invitation invalide ou inexistant.'
    };
  }
  if (!team.codeInvitationActif) {
    return {
      errorStatus: 400,
      message: 'Ce code d’invitation a été désactivé par l’administrateur.'
    };
  }
  if (team.codeInvitationExpire) {
    return {
      errorStatus: 400,
      message: 'Ce code d’invitation a expiré. Demandez un nouveau code à l’administrateur.'
    };
  }
  return { team };
};

const isTeamMember = async (teamId, userEmail) => {
  const [rows] = await getPool().query(
    'SELECT role_membre AS roleMembre, joined_at AS joinedAt FROM membres_equipes WHERE equipe_id = ? AND utilisateur_email = ? LIMIT 1',
    [teamId, userEmail]
  );
  return rows[0] || null;
};

const getTeams = async (req, res, next) => {
  try {
    const includeKey = canManageTeams(req.user);
    const [rows] = await getPool().query(
      `SELECT ${TEAM_FIELDS},
              mine.role_membre AS roleMembre,
              mine.joined_at AS joinedAt,
              (SELECT COUNT(*) FROM membres_equipes total WHERE total.equipe_id = e.id) AS membresInscrits
       FROM equipes e
       LEFT JOIN membres_equipes mine
         ON mine.equipe_id = e.id AND mine.utilisateur_email = ?
       ORDER BY e.id ASC`,
      [req.user.email]
    );
    const data = rows.map((row) => serializeTeam(row, { includeKey }));
    res.json({
      success: true,
      dataType: 'mysql',
      data,
      note: 'Profils fictifs utilisés pour les données de démonstration'
    });
  } catch (error) {
    next(error);
  }
};

const getMyTeams = async (req, res, next) => {
  try {
    const includeKey = canManageTeams(req.user);
    const [rows] = await getPool().query(
      `SELECT ${TEAM_FIELDS},
              me.role_membre AS roleMembre,
              me.joined_at AS joinedAt,
              (SELECT COUNT(*) FROM membres_equipes total WHERE total.equipe_id = e.id) AS membresInscrits
       FROM membres_equipes me
       JOIN equipes e ON e.id = me.equipe_id
       WHERE me.utilisateur_email = ?
       ORDER BY me.joined_at DESC, e.id ASC`,
      [req.user.email]
    );
    const data = rows.map((row) => serializeTeam(row, { includeKey }));
    res.json({ success: true, dataType: 'mysql', data });
  } catch (error) {
    next(error);
  }
};

const createTeam = async (req, res, next) => {
  try {
    const nom = text(req.body.nom, { field: 'Nom de l’équipe', min: 2, max: 200, required: true });
    const description = text(req.body.description, {
      field: 'Description',
      min: 0,
      max: 2000,
      fallback: ''
    });
    const zone = text(req.body.zone, { field: 'Zone', min: 0, max: 150, fallback: '' });
    const responsable = text(req.body.responsable, {
      field: 'Responsable',
      min: 0,
      max: 150,
      fallback: 'Non assigné'
    });
    const membres = integer(req.body.membres, {
      field: 'Nombre de membres',
      min: 0,
      max: 10000,
      fallback: 0
    });
    const activitesAttribuees = integer(req.body.activitesAttribuees, {
      field: 'Activités attribuées',
      min: 0,
      max: 10000,
      fallback: 0
    });
    const statut = oneOf(req.body.statut, TEAM_STATUSES, {
      field: 'Statut',
      fallback: 'en_preparation'
    });

    const [rows] = await getPool().query(
      `SELECT MAX(CAST(SUBSTRING_INDEX(id, '-', -1) AS UNSIGNED)) AS maxId FROM equipes WHERE id LIKE 'EQ-%'`
    );
    const nextId = (Number(rows[0] && rows[0].maxId) || 0) + 1;
    const id = `EQ-${String(nextId).padStart(3, '0')}`;
    const codeInvitation = await generateUniqueTeamCode(getPool());

    await getPool().query(
      `INSERT INTO equipes
         (id, nom, description, zone, responsable, membres, activites_attribuees, statut,
          code_invitation, code_invitation_actif, code_invitation_expire_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`,
      [
        id,
        nom,
        description,
        zone,
        responsable,
        membres,
        activitesAttribuees,
        statut,
        codeInvitation
      ]
    );

    const team = await findTeamById(id);
    res.status(201).json({
      success: true,
      dataType: 'mysql',
      message: 'Équipe créée. Sa clé d’invitation est active.',
      data: serializeTeam(team, { includeKey: true })
    });
  } catch (error) {
    next(error);
  }
};

const updateTeam = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const existing = await findTeamById(teamId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const nom = text(req.body.nom !== undefined ? req.body.nom : existing.nom, {
      field: 'Nom de l’équipe',
      min: 2,
      max: 200,
      required: true
    });
    const description = text(
      req.body.description !== undefined ? req.body.description : existing.description,
      { field: 'Description', min: 0, max: 2000, fallback: '' }
    );
    const zone = text(req.body.zone !== undefined ? req.body.zone : existing.zone, {
      field: 'Zone',
      min: 0,
      max: 150,
      fallback: ''
    });
    const responsable = text(
      req.body.responsable !== undefined ? req.body.responsable : existing.responsable,
      { field: 'Responsable', min: 0, max: 150, fallback: 'Non assigné' }
    );
    const membres = integer(
      req.body.membres !== undefined ? req.body.membres : existing.membres,
      { field: 'Nombre de membres', min: 0, max: 10000, fallback: 0 }
    );
    const activitesAttribuees = integer(
      req.body.activitesAttribuees !== undefined
        ? req.body.activitesAttribuees
        : existing.activitesAttribuees,
      { field: 'Activités attribuées', min: 0, max: 10000, fallback: 0 }
    );
    const statut = oneOf(
      req.body.statut !== undefined ? req.body.statut : existing.statut,
      TEAM_STATUSES,
      { field: 'Statut', fallback: 'en_preparation' }
    );

    await getPool().query(
      `UPDATE equipes
       SET nom = ?, description = ?, zone = ?, responsable = ?, membres = ?,
           activites_attribuees = ?, statut = ?
       WHERE id = ?`,
      [nom, description, zone, responsable, membres, activitesAttribuees, statut, teamId]
    );

    const team = await findTeamById(teamId);
    res.json({
      success: true,
      message: 'Équipe mise à jour',
      data: serializeTeam(team, { includeKey: canManageTeams(req.user) })
    });
  } catch (error) {
    next(error);
  }
};

const deleteTeam = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    // La suppression est atomique : les adhésions sont retirées par la
    // contrainte ON DELETE CASCADE et la clé d'invitation disparaît avec l'équipe.
    await getPool().query('DELETE FROM equipes WHERE id = ?', [teamId]);

    res.json({ success: true, message: `L’équipe ${team.nom} a été supprimée.`, id: teamId });
  } catch (error) {
    next(error);
  }
};

const regenerateInvitationCode = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const expireDansJours = integer(req.body.expireDansJours, {
      field: 'Durée de validité',
      min: 0,
      max: 3650,
      fallback: null
    });
    const codeInvitation = await generateUniqueTeamCode(getPool());

    if (expireDansJours && expireDansJours > 0) {
      await getPool().query(
        `UPDATE equipes
         SET code_invitation = ?, code_invitation_actif = 1,
             code_invitation_expire_le = DATE_ADD(NOW(), INTERVAL ? DAY)
         WHERE id = ?`,
        [codeInvitation, expireDansJours, teamId]
      );
    } else {
      await getPool().query(
        `UPDATE equipes
         SET code_invitation = ?, code_invitation_actif = 1,
             code_invitation_expire_le = NULL
         WHERE id = ?`,
        [codeInvitation, teamId]
      );
    }

    const updated = await findTeamById(teamId);
    res.json({
      success: true,
      message: 'Nouvelle clé d’invitation générée. L’ancienne clé n’est plus valide.',
      codeInvitation,
      data: serializeTeam(updated, { includeKey: true })
    });
  } catch (error) {
    next(error);
  }
};

const setInvitationStatus = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const actif = booleanFlag(req.body.actif, {
      field: 'Statut de la clé',
      required: true
    });
    if (!team.codeInvitation) {
      return res.status(400).json({
        success: false,
        message: 'Cette équipe ne possède pas encore de clé d’invitation.'
      });
    }

    await getPool().query(
      'UPDATE equipes SET code_invitation_actif = ? WHERE id = ?',
      [actif ? 1 : 0, teamId]
    );

    const updated = await findTeamById(teamId);
    res.json({
      success: true,
      message: actif ? 'La clé d’invitation est activée.' : 'La clé d’invitation est désactivée.',
      data: serializeTeam(updated, { includeKey: true })
    });
  } catch (error) {
    next(error);
  }
};

const verifyInvitationCode = async (req, res, next) => {
  try {
    const code = validateInvitationCode(req.body.code);
    const resolved = await resolveInvitation(code, req.user.email);
    if (resolved.message) {
      return res.status(resolved.errorStatus).json({ success: false, message: resolved.message });
    }

    const team = resolved.team;
    return res.json({
      success: true,
      valid: true,
      dejaMembre: Boolean(team.roleMembre),
      equipe: serializeTeam(team)
    });
  } catch (error) {
    return next(error);
  }
};

const joinTeam = async (req, res, next) => {
  try {
    const code = validateInvitationCode(req.body.code);
    const resolved = await resolveInvitation(code, req.user.email);
    if (resolved.message) {
      return res.status(resolved.errorStatus).json({ success: false, message: resolved.message });
    }

    const team = resolved.team;
    if (team.roleMembre) {
      return res.status(409).json({
        success: false,
        message: `Vous êtes déjà membre de l’équipe ${team.nom}.`
      });
    }

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        'INSERT INTO membres_equipes (equipe_id, utilisateur_email, role_membre) VALUES (?, ?, ?)',
        [team.id, req.user.email, 'membre']
      );
      await connection.query(
        'UPDATE equipes SET membres = membres + 1 WHERE id = ?',
        [team.id]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error && error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: `Vous êtes déjà membre de l’équipe ${team.nom}.`
        });
      }
      throw error;
    } finally {
      connection.release();
    }

    const joinedTeam = serializeTeam({
      ...team,
      membres: Number(team.membres) + 1,
      membresInscrits: Number(team.membresInscrits) + 1,
      roleMembre: 'membre',
      joinedAt: new Date().toISOString()
    });

    return res.json({
      success: true,
      message: `Vous avez rejoint l’équipe ${team.nom}.`,
      equipe: joinedTeam
    });
  } catch (error) {
    return next(error);
  }
};

const leaveTeam = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const membership = await isTeamMember(teamId, req.user.email);
    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'Vous ne faites pas partie de cette équipe.'
      });
    }

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'DELETE FROM membres_equipes WHERE equipe_id = ? AND utilisateur_email = ?',
        [teamId, req.user.email]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Vous ne faites pas partie de cette équipe.'
        });
      }
      await connection.query(
        'UPDATE equipes SET membres = CASE WHEN membres > 0 THEN membres - 1 ELSE 0 END WHERE id = ?',
        [teamId]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.json({
      success: true,
      message: `Vous avez quitté l’équipe ${team.nom}.`
    });
  } catch (error) {
    return next(error);
  }
};

const getTeamMembers = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const manager = canManageTeams(req.user);
    const membership = manager ? null : await isTeamMember(teamId, req.user.email);
    if (!manager && !membership) {
      return res.status(403).json({
        success: false,
        message: 'Vous devez être membre de cette équipe pour consulter ses membres.'
      });
    }

    const [rows] = await getPool().query(
      `SELECT u.nom, u.email, u.role,
              me.role_membre AS roleMembre, me.joined_at AS joinedAt
       FROM membres_equipes me
       JOIN utilisateurs u ON u.email = me.utilisateur_email
       WHERE me.equipe_id = ?
       ORDER BY me.joined_at ASC, u.nom ASC`,
      [teamId]
    );

    const data = rows.map((row) => ({
      nom: row.nom,
      email: manager ? row.email : undefined,
      role: row.role,
      roleMembre: row.roleMembre,
      joinedAt: row.joinedAt
    }));

    return res.json({
      success: true,
      data,
      equipe: serializeTeam(team, { includeKey: manager })
    });
  } catch (error) {
    return next(error);
  }
};

const addTeamMember = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const emailValue = validateEmail(req.body.email);
    const [users] = await getPool().query(
      'SELECT nom, email, role, actif FROM utilisateurs WHERE email = ? LIMIT 1',
      [emailValue]
    );
    const user = users[0];
    if (!user || !user.actif) {
      return res.status(404).json({
        success: false,
        message: 'Aucun compte actif ne correspond à cet email.'
      });
    }

    const existing = await isTeamMember(teamId, user.email);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `${user.nom} est déjà membre de cette équipe.`
      });
    }

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        'INSERT INTO membres_equipes (equipe_id, utilisateur_email, role_membre) VALUES (?, ?, ?)',
        [teamId, user.email, 'membre']
      );
      await connection.query(
        'UPDATE equipes SET membres = membres + 1 WHERE id = ?',
        [teamId]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      if (error && error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          message: `${user.nom} est déjà membre de cette équipe.`
        });
      }
      throw error;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      success: true,
      message: `${user.nom} a été ajouté à l’équipe.`,
      data: {
        nom: user.nom,
        email: user.email,
        role: user.role,
        roleMembre: 'membre',
        joinedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return next(error);
  }
};

const updateMemberRole = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const memberEmail = validateEmail(req.params.email, { field: 'Email du membre' });
    const roleMembre = oneOf(req.body.roleMembre, MEMBER_ROLES, {
      field: 'Rôle dans l’équipe',
      required: true
    });

    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const membership = await isTeamMember(teamId, memberEmail);
    if (!membership) {
      return res.status(404).json({ success: false, message: 'Ce membre ne fait pas partie de l’équipe.' });
    }

    await getPool().query(
      'UPDATE membres_equipes SET role_membre = ? WHERE equipe_id = ? AND utilisateur_email = ?',
      [roleMembre, teamId, memberEmail]
    );

    return res.json({
      success: true,
      message: 'Rôle du membre mis à jour.',
      data: { equipeId: teamId, utilisateurEmail: memberEmail, roleMembre }
    });
  } catch (error) {
    return next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const teamId = readTeamId(req.params.id);
    const memberEmail = validateEmail(req.params.email, { field: 'Email du membre' });

    const team = await findTeamById(teamId);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Équipe introuvable' });
    }

    const connection = await getPool().getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'DELETE FROM membres_equipes WHERE equipe_id = ? AND utilisateur_email = ?',
        [teamId, memberEmail]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Ce membre ne fait pas partie de l’équipe.'
        });
      }
      await connection.query(
        'UPDATE equipes SET membres = CASE WHEN membres > 0 THEN membres - 1 ELSE 0 END WHERE id = ?',
        [teamId]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return res.json({ success: true, message: 'Membre retiré de l’équipe.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getTeams,
  getMyTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  regenerateInvitationCode,
  setInvitationStatus,
  verifyInvitationCode,
  joinTeam,
  leaveTeam,
  getTeamMembers,
  addTeamMember,
  updateMemberRole,
  removeMember
};
