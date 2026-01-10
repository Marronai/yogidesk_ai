const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // 🔐 Password Hashing

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

  // 🔒 SECURITY: Password tabhi required hai jab Google ID na ho
  password: {
    type: String,
    minlength: 6,
    select: false, // 🛡️ Database query karte waqt password return nahi hoga
    required: function() { return !this.googleId; } // Google login walon ko password nahi chahiye
  },
  
  // 🆕 ROLE: 'user' add kiya taaki purane accounts crash na karein
  role: {
    type: String,
    enum: ['user', 'trial_user', 'admin', 'manager', 'employee'], 
    default: 'trial_user'
  },
  
  // 🏢 BUSINESS INFO
  businessName: String,
  businessType: { 
    type: String, 
    default: 'general' 
  },
  industry: {
    type: String,
    enum: ['general', 'hospital', 'education', 'startup', 'ecommerce'],
    default: 'general'
  },

  // 💬 WHATSAPP API CONFIGURATION (SaaS Model)
  whatsappConfig: {
    phoneNumberId: { type: String, default: "" },
    wabaId: { type: String, default: "" },
    // 🛡️ SECURITY: Token ko hide kiya taaki hack hone par leak na ho
    accessToken: { type: String, default: "", select: false }, 
    isConfigured: { type: Boolean, default: false }
  },
  
  // 🔥 SUBSCRIPTION & PLAN LOGIC
  planType: {
    type: String,
    // ✅ FIX: Yahan se 'user' hata diya (wo galti se aya tha) aur syntax theek kiya
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

  // 🕒 SHIFT TIMING (For Employees)
  shiftStart: { type: String, default: "09:00" },
  shiftEnd: { type: String, default: "18:00" },

  // 🆕 GOOGLE AUTH & OTP FIELDS
  googleId: { type: String }, // Google walo ki unique ID
  avatar: { type: String },   // User ki photo
  
  otp: { type: String, select: false }, // Hidden
  otpExpires: { type: Date, select: false },       
  
  isVerified: { 
    type: Boolean, 
    default: false 
  }, 

  // 🛡️ SESSION MANAGEMENT (Logout Fix)
  currentSessionId: { type: String }, 

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
UserSchema.pre('save', async function(next) {
  // 1. Agar password change nahi hua, toh aage badho
  if (!this.isModified('password')) {
    return next();
  }

  // 2. Agar Google user hai (password null hai), toh aage badho
  if (!this.password) {
    return next();
  }
  
  // 3. Password Hash karo
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// -----------------------------------------------------
// 🔑 METHODS
// -----------------------------------------------------

// 1. Password Match Checker
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false; // Google users ke liye false
  return await bcrypt.compare(enteredPassword, this.password);
};

// 2. Account Active Checker
UserSchema.methods.isAccountActive = function() {
    const now = new Date();
    // Status active/trial ho AUR date expiry se kam ho
    if ((this.subscriptionStatus === 'active' || this.subscriptionStatus === 'trial') && this.planExpiryDate > now) {
        return true;
    }
    return false;
};

// 3. Reset Password Token Generator
UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Token Hash karke DB me save karo
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 Minutes
  
  return resetToken;
};

module.exports = mongoose.model('User', UserSchema);