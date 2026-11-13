const express = require('express');
const router = express.Router();
const {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changeRole,
  changeStatus,
  resetPassword,
  deleteUser
} = require('../controllers/usersController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Toute la gestion des utilisateurs exige une session valide et la permission
// « users.read ». Les écritures vérifient en plus « users.manage » / « users.delete ».
router.use(requireAuth);
router.use(requirePermission('users.read'));

router.get('/', listUsers);
router.get('/:email', getUser);

router.post('/', requirePermission('users.manage'), writeLimiter, createUser);
router.put('/:email', requirePermission('users.manage'), writeLimiter, updateUser);
router.patch('/:email/role', requirePermission('users.manage'), writeLimiter, changeRole);
router.patch('/:email/status', requirePermission('users.manage'), writeLimiter, changeStatus);
router.post('/:email/reset-password', requirePermission('users.manage'), writeLimiter, resetPassword);
router.delete('/:email', requirePermission('users.delete'), writeLimiter, deleteUser);

module.exports = router;
