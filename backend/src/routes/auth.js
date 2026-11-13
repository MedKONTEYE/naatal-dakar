const express = require('express');
const router = express.Router();
const { login, register, me, changePassword, updateProfile, logout } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, registerLimiter, writeLimiter } = require('../middleware/rateLimit');

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.post('/login', loginLimiter, login);
router.post('/register', registerLimiter, register);
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, writeLimiter, updateProfile);
router.put('/password', requireAuth, writeLimiter, changePassword);
router.post('/logout', requireAuth, logout);

module.exports = router;
