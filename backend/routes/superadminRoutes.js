const express = require('express');
const { requireSuperadminMetadata } = require('../middleware/superadminGate');
const { createLocalRateLimiter } = require('../utils/superadminSecurity');
const {
  getCentralAnalyticsMonitor,
  getTemplateSyncAlerts,
  getWebhookFailures,
} = require('../controllers/adminPanelController');
const {
  adjustWallet,
  createImpersonationSession,
  getOwnerOverview,
  getSuperadminMe,
  getUserMatrix,
  inviteSuperadminStaff,
  listSuperadminStaff,
  loginSuperadmin,
  updateUserStatus,
} = require('../controllers/superadminController');

const router = express.Router();
const loginLimiter = createLocalRateLimiter({ windowMs: 15 * 60 * 1000, max: 6 });
const requireOperationalMonitorPermission = (req, res, next) => {
  if (
    req.superadminRole === 'owner' ||
    req.superadminPermissions?.can_view_owner_overview ||
    req.superadminPermissions?.can_manage_meta_compliance
  ) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'This super admin staff account does not have permission for operational monitors.' });
};

router.post('/login', loginLimiter, loginSuperadmin);
router.use(requireSuperadminMetadata);
router.get('/me', getSuperadminMe);
router.get('/staff/list', listSuperadminStaff);
router.post('/staff/invite', inviteSuperadminStaff);
router.get('/webhook-failures', requireOperationalMonitorPermission, getWebhookFailures);
router.get('/template-sync-alerts', requireOperationalMonitorPermission, getTemplateSyncAlerts);
router.get('/central-analytics-monitor', requireOperationalMonitorPermission, getCentralAnalyticsMonitor);
router.get('/overview', getOwnerOverview);
router.get('/users', getUserMatrix);
router.patch('/users/:userId/status', updateUserStatus);
router.post('/users/:userId/impersonate', createImpersonationSession);
router.post('/users/:userId/wallet-adjustment', adjustWallet);

module.exports = router;
