const express = require('express');
const router = express.Router();
const { readCampagne, updateCampagne } = require('../controllers/campagneController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

router.get('/', readCampagne);
router.put('/', requireAuth, requirePermission('settings.manage'), writeLimiter, updateCampagne);

module.exports = router;
