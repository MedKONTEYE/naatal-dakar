const express = require('express');
const router = express.Router();
const {
  getTrees,
  getArbres,
  getArbreByCode,
  createPlantation,
  updatePlantation,
  deletePlantation
} = require('../controllers/treesController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);

router.get('/', getTrees);
router.get('/arbres', getArbres);
router.get('/scan/:code', getArbreByCode);
router.post('/', requireAuth, requirePermission('operations.write'), writeLimiter, createPlantation);
router.put('/:id', requireAuth, requirePermission('operations.write'), writeLimiter, updatePlantation);
router.delete('/:id', requireAuth, requirePermission('operations.delete'), writeLimiter, deletePlantation);

module.exports = router;
