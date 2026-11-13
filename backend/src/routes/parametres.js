const express = require('express');
const router = express.Router();
const {
  getParametres,
  updateProgramme,
  updateObjectifs
} = require('../controllers/parametresController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

// Lecture publique : informations institutionnelles et objectifs prévisionnels.
router.get('/', getParametres);

// Écriture réservée aux administrateurs (permission `settings.manage`).
router.put('/programme', requireAuth, requirePermission('settings.manage'), writeLimiter, updateProgramme);
router.put('/objectifs', requireAuth, requirePermission('settings.manage'), writeLimiter, updateObjectifs);

module.exports = router;
