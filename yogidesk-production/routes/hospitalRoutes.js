const express = require('express');
const router = express.Router();
const { admitPatient, dischargePatient, getPatients } = require('../controllers/hospitalController');
const { protect } = require('../middleware/auth');

router.get('/patients', protect, getPatients);
router.post('/admit', protect, admitPatient);
router.post('/discharge', protect, dischargePatient);

module.exports = router;