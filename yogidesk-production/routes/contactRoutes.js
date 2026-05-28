// backend/routes/contactRoutes.js

const express = require('express');
const router = express.Router();
const multer = require('multer');

// 👇 Check karein: Kya 'protect' sahi se import hua hai?
const { protect } = require('../middleware/auth'); 

// 👇 Check karein: Kya 'uploadCSV' yahan list mein hai?
const { getContacts, addContact, uploadCSV } = require('../controllers/contactController');

const upload = multer({ dest: 'uploads/' });

// Debugging: Ye 3 lines add karke server chalayein.
// Agar inmein se koi 'undefined' print hua, toh wahi galti hai.
console.log("Protect:", protect);     
console.log("UploadCSV:", uploadCSV); 
console.log("Multer:", upload);

router.get('/', protect, getContacts);
router.post('/', protect, addContact);

// ⚠️ Sabse common galti yahan hoti hai:
router.post('/upload', protect, upload.single('file'), uploadCSV);

module.exports = router;