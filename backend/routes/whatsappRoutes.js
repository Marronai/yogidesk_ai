const express = require('express');
const router = express.Router();
const { sendTestMessage, submitTemplate } = require('../controllers/whatsappController');
const { protect } = require('../middleware/auth'); // Sirf logged-in user bhej sake

// Test Message Route
router.post('/send-test', protect, sendTestMessage);

// Submit Template Route
router.post('/submit-template', protect, submitTemplate);

module.exports = router;