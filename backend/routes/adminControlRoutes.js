const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminMiddleware');
const {
  getAdminSummary,
  getCentralAnalyticsMonitor,
  getAdminClinics,
  getTemplateSyncAlerts,
  updateClinicStatus,
  getWebhookFailures,
  getTransactionLogs
} = require('../controllers/adminPanelController');
const { getUserMatrix } = require('../controllers/superadminController');

const router = express.Router();
router.use(requireSuperAdmin);

router.get('/summary', getAdminSummary);
router.get('/clinics', getAdminClinics);
router.patch('/clinics/:clinicId/status', updateClinicStatus);
router.get('/transactions', getTransactionLogs);
router.get('/metrics-summary', getAdminSummary);
router.get('/universal-matrix', getUserMatrix);
router.get('/webhook-failures', getWebhookFailures);
router.get('/template-sync-alerts', getTemplateSyncAlerts);
router.get('/central-analytics-monitor', getCentralAnalyticsMonitor);

module.exports = router;
