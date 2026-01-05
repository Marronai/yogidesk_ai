const mongoose = require('mongoose');

const PatientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Ye hospital (Admin) ki ID hai
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  doctorName: String,
  department: String,
  status: {
    type: String,
    enum: ['admitted', 'discharged'],
    default: 'admitted'
  },
  admitDate: {
    type: Date,
    default: Date.now
  },
  dischargeDate: Date
});

module.exports = mongoose.model('Patient', PatientSchema);