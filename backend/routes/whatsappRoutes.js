const express = require('express');
const router = express.Router();
const { sendTestMessage } = require('../controllers/whatsappController');
const { protect } = require('../middleware/auth'); // Sirf logged-in user bhej sake

// Test Message Route
router.post('/send-test', protect, sendTestMessage);

module.exports = router;