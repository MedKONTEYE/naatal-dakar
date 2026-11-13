const express = require('express');
const router = express.Router();
const { getCitizens, createCitizen } = require('../controllers/citizensController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);

router.get('/', getCitizens);
router.post('/', requireAuth, requirePermission('operations.write'), writeLimiter, createCitizen);

module.exports = router;
