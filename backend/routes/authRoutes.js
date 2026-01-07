const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🔒 SECURITY PATCH

// 👇 Import Updated Controller Functions
// Dhyan de: Humne 'verifyOtp' ko hata kar 2 alag functions import kiye hain
const { 
  register, 
  verifySignupOtp, // ✅ New: Signup verify karne ke liye
  loginStep1, 
  verifyLoginOtp,  // ✅ New: Login verify karne ke liye
  googleLogin,
  forgotPassword, 
  resetPassword
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// -------------------------------------------------
// 🔒 SECURITY: RATE LIMITERS (Brute Force Blocker)
// -------------------------------------------------

// Login Limiter: 10 mins mein sirf 5 attempts
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 5, 
  message: { msg: "Too many login attempts, please try again after 10 minutes" }
});

// Create Account Limiter: Spam Accounts rokne ke liye
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, 
  message: { msg: "Too many accounts created from this IP, please try again later" }
});

// -------------------------------------------------
// 🚀 PUBLIC ROUTES (No Token Needed)
// -------------------------------------------------

// 1. Register Flow (Signup)
router.post('/register', createAccountLimiter, register);          // Step 1: Details lo -> OTP Bhejo
router.post('/verify-signup', createAccountLimiter, verifySignupOtp); // Step 2: OTP check -> Welcome Email -> Token

// 2. Login Flow (Login)
router.post('/login', loginLimiter, loginStep1);                  // Step 1: Email/Pass check -> OTP Bhejo
router.post('/verify-login', loginLimiter, verifyLoginOtp);       // Step 2: OTP check -> Token

// 3. Google Login
router.post('/google', googleLogin); 

// 4. Password Recovery
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resetToken', resetPassword);

// -------------------------------------------------
// 🛡️ PROTECTED ROUTES (Token Required)
// -------------------------------------------------

// Session Check
router.get('/check-session', protect, (req, res) => {
  res.status(200).json({ status: 'active', user: req.user });
});

module.exports = router;