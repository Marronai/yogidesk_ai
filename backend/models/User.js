const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  // 1. BASIC INFO
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
  phone: { 
    type: String,
    default: ""
  },

  // 🔒 SECURITY
  password: {
    type: String,
    minlength: 6,
    select: false,
    required: function() { return !this.googleId; }
  },
  
  // 🆕 ROLE FIX: 'user' add kiya taaki purane accounts crash na karein
  role: {
    type: String,
    enum: ['user', 'trial_user', 'admin', 'manager', 'employee'], 
    default: 'trial_user'
  },
  
  // 🏢 BUSINESS INFO
  businessName: String,
  businessType: { type: String, default: 'general' },
  industry: {
    type: String,
    enum: ['general', 'hospital', 'education', 'startup', 'ecommerce'],
    default: 'general'
  },

  // 💬 WHATSAPP API
  whatsappConfig: {
    phoneNumberId: { type: String, default: "" },
    wabaId: { type: String, default: "" },
    accessToken: { type: String, default: "", select: false }, 
    isConfigured: { type: Boolean, default: false }
  },
  
  // 🔥 SUBSCRIPTION
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
  trialStartDate: { type: Date, default: Date.now },
  planExpiryDate: {
    type: Date,
    default: () => new Date(+new Date() + 5*24*60*60*1000) 
  },

  // 🕒 SHIFT TIMING
  shiftStart: { type: String, default: "09:00" },
  shiftEnd: { type: String, default: "18:00" },

  // 🆕 GOOGLE AUTH
  googleId: { type: String },
  avatar: { type: String },
  otp: { type: String, select: false },
  otpExpires: { type: Date, select: false },       
  isVerified: { type: Boolean, default: false }, 

  // 🛡️ SESSION
  currentSessionId: { type: String }, 

  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: { type: Date, default: Date.now }
});

// -----------------------------------------------------
// 🔒 MIDDLEWARE FIX (No 'next' used)
// -----------------------------------------------------
// 👇 Yahan se 'next' parameter hata diya hai
UserSchema.pre('save', async function() {
  // 1. Return directly (No next())
  if (!this.isModified('password')) {
    return;
  }

  // 2. Return directly
  if (!this.password) {
    return;
  }
  
  // 3. Hash Password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  // Async function automatically promise resolve kar lega
});

// -----------------------------------------------------
// 🔑 METHODS
// -----------------------------------------------------

UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.isAccountActive = function() {
    const now = new Date();
    if ((this.subscriptionStatus === 'active' || this.subscriptionStatus === 'trial') && this.planExpiryDate > now) {
        return true;
    }
    return false;
};

UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);