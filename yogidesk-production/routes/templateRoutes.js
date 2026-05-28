const express = require('express');
const router = express.Router();
const { createTemplate, getTemplates } = require('../controllers/templateController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getTemplates);
router.post('/', protect, createTemplate);

module.exports = router;