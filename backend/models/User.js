const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, select: false }, // Google login walon ke paas password nahi hota
  
  // ... Baki fields (phone, businessName etc.) ...

  googleId: { type: String }, // Google Login ke liye
  avatar: { type: String },
  
  role: { 
    type: String, 
    enum: ['user', 'admin', 'employee', 'manager', 'trial_user'], 
    default: 'user' 
  },
  
  // 👇👇 YE MISSING THA! ISKO ADD KARO 👇👇
  currentSessionId: { type: String }, 
  // 👆👆 Ye line bohot zaroori hai logout issue rokne ke liye
  
  isVerified: { type: Boolean, default: false },
  
  // OTP Fields
  otp: { type: String, select: false },
  otpExpires: { type: Date, select: false },
  
  // Plan/Shift Fields
  planType: { type: String, default: 'free' },
  planExpiryDate: { type: Date },
  shiftStart: { type: String },
  shiftEnd: { type: String },

}, { timestamps: true });

// Password Hash Middleware (Agar pehle se hai toh rehne do)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Password Match Method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);