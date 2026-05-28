const express = require('express');
const router = express.Router();
const { sendTestMessage, submitTemplate, syncTemplateStatus } = require('../controllers/whatsappController');
const { createTemplate, getTemplates } = require('../controllers/templateController');
const { protect } = require('../middleware/auth'); // Sirf logged-in user bhej sake

// Test Message Route
router.post('/send-test', protect, sendTestMessage);

// Submit Template Route
router.post('/submit-template', protect, submitTemplate);
router.post('/templates/sync', protect, syncTemplateStatus);
router.get('/templates', protect, getTemplates);
router.post('/templates', protect, createTemplate);

module.exports = router;
