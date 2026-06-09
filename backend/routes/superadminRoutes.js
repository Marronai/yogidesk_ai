const express = require('express');
const { requireSuperadminMetadata } = require('../middleware/superadminGate');
const { createLocalRateLimiter } = require('../utils/superadminSecurity');
const {
  adjustWallet,
  getOwnerOverview,
  getSuperadminMe,
  getUserMatrix,
  loginSuperadmin,
  updateUserStatus,
} = require('../controllers/superadminController');

const router = express.Router();
const loginLimiter = createLocalRateLimiter({ windowMs: 15 * 60 * 1000, max: 6 });

router.post('/login', loginLimiter, loginSuperadmin);
router.use(requireSuperadminMetadata);
router.get('/me', getSuperadminMe);
router.get('/overview', getOwnerOverview);
router.get('/users', getUserMatrix);
router.patch('/users/:userId/status', updateUserStatus);
router.post('/users/:userId/wallet-adjustment', adjustWallet);

module.exports = router;
