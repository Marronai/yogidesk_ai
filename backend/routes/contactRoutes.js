// backend/routes/contactRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');

// 👇 Check karein: Kya 'protect' sahi se import hua hai?
const { protect } = require('../middleware/auth'); 

// 👇 Check karein: Kya 'uploadCSV' yahan list mein hai?
const { getContacts, addContact, uploadCSV } = require('../controllers/contactController');

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const safeName = String(file.originalname || '').toLowerCase();
    const safeMime = String(file.mimetype || '').toLowerCase();
    const isCsv = safeName.endsWith('.csv') && ['text/csv', 'application/vnd.ms-excel', 'application/csv'].includes(safeMime);
    cb(isCsv ? null : new Error('Only CSV files are allowed.'), isCsv);
  },
});

router.get('/', protect, getContacts);
router.post('/', protect, addContact);

// ⚠️ Sabse common galti yahan hoti hai:
router.post('/upload', protect, upload.single('file'), uploadCSV);

module.exports = router;
