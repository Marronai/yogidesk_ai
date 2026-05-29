const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminMiddleware');
const {
  getAdminSummary,
  getAdminClinics,
  updateClinicStatus,
  getTransactionLogs
} = require('../controllers/adminPanelController');

const router = express.Router();
router.use(requireSuperAdmin);

router.get('/summary', getAdminSummary);
router.get('/clinics', getAdminClinics);
router.patch('/clinics/:clinicId/status', updateClinicStatus);
router.get('/transactions', getTransactionLogs);
router.get('/metrics-summary', getAdminSummary);

module.exports = router;
