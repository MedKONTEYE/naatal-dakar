const express = require('express');
const router = express.Router();
const { 
  getAllInterventions, 
  getInterventionById, 
  createIntervention, 
  updateIntervention, 
  deleteIntervention 
} = require('../controllers/interventionsController');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { writeLimiter } = require('../middleware/rateLimit');

router.use(requireAuth);

router.get('/', getAllInterventions);
router.get('/:id', getInterventionById);
router.post('/', requireAuth, requirePermission('operations.write'), writeLimiter, createIntervention);
router.put('/:id', requireAuth, requirePermission('operations.write'), writeLimiter, updateIntervention);
router.delete('/:id', requireAuth, requirePermission('operations.delete'), writeLimiter, deleteIntervention);

module.exports = router;
