const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🔒 SECURITY PATCH: Anti-Brute Force

// 👇 Import Updated Controller Functions
const { 
  register, 
  loginStep1, 
  verifyOtp, 
  googleLogin,
  forgotPassword, 
  resetPassword,
  // getMe // Agar tumne getMe controller me nahi banaya hai toh hata do, warna uncomment karo
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// -------------------------------------------------
// 🔒 SECURITY: RATE LIMITERS (Brute Force Blocker)
// -------------------------------------------------

// Login Limiter: 10 mins mein sirf 5 attempts allow karega
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

// 1. Register (With Spam Protection)
router.post('/register', createAccountLimiter, register);

// 2. Login Flow (With Brute Force Protection)
router.post('/login', loginLimiter, loginStep1);      // Step 1: Send Creds -> Get OTP
router.post('/verify-otp', loginLimiter, verifyOtp);  // Step 2: Send OTP -> Get Token

// 3. Google Login
router.post('/google', googleLogin); 

// 4. Password Recovery
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resetToken', resetPassword);

// -------------------------------------------------
// 🛡️ PROTECTED ROUTES (Token Required)
// -------------------------------------------------

// User Profile fetch karne ke liye (Agar controller me getMe hai toh ise use karo)
// router.get('/me', protect, getMe); 

// Session active hai ya nahi check karne ke liye
router.get('/check-session', protect, (req, res) => {
  res.status(200).json({ status: 'active', user: req.user });
});

module.exports = router;