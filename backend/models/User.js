const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },
  phone: { type: String, trim: true, default: '' },
  role: { type: String, enum: ['user', 'admin', 'employee', 'manager'], default: 'user' },
  businessName: { type: String, trim: true, default: '' },
  businessType: { type: String, trim: true, default: 'Clinic' },
  businessCategory: { type: String, trim: true, default: 'Clinic' },
  industry: { type: String, trim: true, default: '' },
  planType: { type: String, default: 'starter_clinic' },
  subscriptionStatus: { type: String, default: 'wallet_active' },
  isSubscribed: { type: Boolean, default: false },
  subscriptionStartDate: { type: Date },
  planExpiryDate: { type: Date },
  amountPaid: { type: Number, default: 0 },
  wallet: {
    balance: { type: Number, default: 50 },
    is_first_recharge: { type: Boolean, default: true }
  },
  whatsappConfig: {
    phoneNumberId: { type: String, default: '' },
    wabaId: { type: String, default: '' },
    accessToken: { type: String, default: '' },
    isConfigured: { type: Boolean, default: false }
  },
  settings: {
    shiftStart: { type: String, default: '09:00' },
    shiftEnd: { type: String, default: '18:00' },
    canViewAds: { type: Boolean, default: false }
  },
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  plan: { type: String, enum: ['Basic', 'Growth', 'Multi-Specialty'], default: 'Basic' },
  aiEnabled: { type: Boolean, default: false },
  tokenLimit: { type: Number, default: 0 },
  tokenUsed: { type: Number, default: 0 },
  isAiPaused: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
