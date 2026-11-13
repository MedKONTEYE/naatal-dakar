const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/teamsController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter, joinTeamLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);

// Lecture et adhésion : accessibles à tout compte connecté.
router.get('/', getTeams);
router.get('/mes-equipes', getMyTeams);
router.post('/verifier-code', joinTeamLimiter, verifyInvitationCode);
router.post('/rejoindre', joinTeamLimiter, joinTeam);
router.delete('/mes-equipes/:id', writeLimiter, leaveTeam);

// Gestion des équipes et des clés : réservée aux administrateurs autorisés.
router.post('/', requirePermission('teams.manage'), writeLimiter, createTeam);
router.put('/:id', requirePermission('teams.manage'), writeLimiter, updateTeam);
router.delete('/:id', requirePermission('teams.manage'), writeLimiter, deleteTeam);
router.post('/:id/code', requirePermission('teams.manage'), writeLimiter, regenerateInvitationCode);
router.patch('/:id/code', requirePermission('teams.manage'), writeLimiter, setInvitationStatus);

// Consultation et gestion des membres.
router.get('/:id/membres', getTeamMembers);
router.post('/:id/membres', requirePermission('teams.manage'), writeLimiter, addTeamMember);
router.patch('/:id/membres/:email', requirePermission('teams.manage'), writeLimiter, updateMemberRole);
router.delete('/:id/membres/:email', requirePermission('teams.manage'), writeLimiter, removeMember);

module.exports = router;
