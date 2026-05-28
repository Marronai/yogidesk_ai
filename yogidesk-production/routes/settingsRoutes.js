const express = require('express');
const router = express.Router();
const { updateProfile, changePassword } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth'); // User login hona zaroori hai

// Profile Update Route (PUT /api/settings/update)
router.put('/update', protect, updateProfile);

// Password Change Route (PUT /api/settings/change-password)
router.put('/change-password', protect, changePassword);

module.exports = router;