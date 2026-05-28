const express = require('express');
const router = express.Router();
const { createTemplate, getTemplates, syncTemplates, deleteTemplate } = require('../controllers/templateController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getTemplates);
router.get('/sync', protect, syncTemplates);
router.post('/', protect, createTemplate);
router.delete('/:id', protect, deleteTemplate);

module.exports = router;
