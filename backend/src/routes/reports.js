const express = require('express');
const router = express.Router();
const { getReports } = require('../controllers/reportsController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', getReports);

module.exports = router;
