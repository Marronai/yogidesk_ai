const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const { createOrder, verifyPayment, uploadPaymentProof } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

const upload = multer({ dest: path.join(__dirname, '../uploads/payment-proof') });

router.post('/create', protect, createOrder);
router.post('/verify', protect, verifyPayment);
router.post('/upload-proof', protect, upload.single('proof'), uploadPaymentProof);

module.exports = router;