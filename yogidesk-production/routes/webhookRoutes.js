const express = require('express');
const router = express.Router();
const { verifyWebhook, handleWebhook } = require('../controllers/webhookController');

router.get('/meta', verifyWebhook);
router.post('/meta', handleWebhook);

module.exports = router;