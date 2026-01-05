const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // 🔐 Password Hashing ke liye

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
  },
  // 🔒 SECURITY FIX: Password tabhi required hai jab Google ID na ho
  password: {
    type: String,
    minlength: 6,
    select: false, // 🛡️ Database query karte waqt password return nahi hoga
    required: function() { return !this.googleId; } 
  },
  
  // 🆕 ROLE UPDATE: Default 'trial_user' rahega (Payment ke baad Admin banega)
  role: {
    type: String,
    enum: ['trial_user', 'admin', 'manager', 'employee'], 
    default: 'trial_user'
  },
  
  // 🏢 BUSINESS INFO
  businessName: String,
  industry: {
    type: String,
    enum: ['general', 'hospital', 'education', 'startup', 'ecommerce'],
    default: 'general'
  },

  // 💬 WHATSAPP API CONFIGURATION (SaaS Model)
  whatsappConfig: {
    phoneNumberId: { type: String, default: "" },
    wabaId: { type: String, default: "" },
    // 🛡️ SECURITY FIX: Token ko hide kiya taaki hack hone par leak na ho
    accessToken: { type: String, default: "", select: false }, 
    isConfigured: { type: Boolean, default: false }
  },
  
  // 🔥 SUBSCRIPTION & PLAN LOGIC (5 Days Trial)
  planType: {
    type: String,
    enum: ['free_trial', 'lite', 'elite', 'bronze', 'premium', 'custom'],
    default: 'free_trial'
  },
  subscriptionStatus: {
    type: String,
    enum: ['trial', 'active', 'expired', 'suspended'],
    default: 'trial'
  },
  trialStartDate: {
    type: Date,
    default: Date.now
  },
  // ✅ 5 Days Trial Expiry Logic
  planExpiryDate: {
    type: Date,
    default: () => new Date(+new Date() + 5*24*60*60*1000) 
  },

  // 🕒 SHIFT TIMING
  shiftStart: { type: String, default: "09:00" },
  shiftEnd: { type: String, default: "18:00" },

  // 🆕 GOOGLE AUTH & OTP FIELDS (Login Security)
  googleId: { type: String }, // Google walo ki unique ID
  avatar: { type: String },   // User ki photo
  
  otp: { type: String, select: false }, // OTP save karne ke liye (Hidden)
  otpExpires: { type: Date },           // OTP expiry time
  isVerified: { type: Boolean, default: false }, // Email verification status

  currentSessionId: String, 
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// -----------------------------------------------------
// 🔒 MIDDLEWARE: PASSWORD ENCRYPTION (Auto-Hash)
// -----------------------------------------------------
// ✅ FIX: 'next' parameter hata diya aur logic update kiya
UserSchema.pre('save', async function() {
  
  // 1. Agar password change nahi hua, toh return kar jao
  if (!this.isModified('password')) {
    return;
  }

  // 2. Agar Google user hai (password null hai), toh return kar jao
  if (!this.password) {
    return;
  }
  
  // 3. Bcrypt se password ko hash bana do
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// -----------------------------------------------------
// 🔑 METHODS
// -----------------------------------------------------

// 1. Password Match Checker (Login ke liye)
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false; // Google users ke liye
  return await bcrypt.compare(enteredPassword, this.password);
};

// 2. Account Active Checker
UserSchema.methods.isAccountActive = function() {
    const now = new Date();
    // Account active tabhi manenge jab status active ho ya trial ho AUR expiry date na nikli ho
    if ((this.subscriptionStatus === 'active' || this.subscriptionStatus === 'trial') && this.planExpiryDate > now) {
        return true;
    }
    return false;
};

// 3. Reset Password Token Generator
UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Token ko hash karke database me save karo (Raw token user ko email hoga)
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 Minutes
  
  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);