const express = require('express');
const router = express.Router();
const { getWaste, createWaste } = require('../controllers/wasteController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);

router.get('/', getWaste);
router.post('/', requireAuth, requirePermission('operations.write'), writeLimiter, createWaste);

module.exports = router;
