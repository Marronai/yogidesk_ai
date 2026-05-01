const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { 
  register, 
  verifySignupOtp,
  loginStep1, 
  verifyLoginOtp,
  googleLogin,
  forgotPassword, 
  resetPassword
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// Rate Limiters
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 5, 
  message: { msg: "Too many login attempts, please try again after 10 minutes" }
});

const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5, 
  message: { msg: "Too many accounts created from this IP, please try again later" }
});

// ✅✅✅ FIX: Add these 2 lines ✅✅✅
router.post('/signup', createAccountLimiter, register); // Alias for /register
router.get('/signup', (req, res) => res.status(405).json({ msg: "Method Not Allowed. Use POST to /api/auth/register" }));

// Main Routes
router.post('/register', createAccountLimiter, register);
router.post('/verify-signup', createAccountLimiter, verifySignupOtp);

router.post('/login', loginLimiter, loginStep1);
router.post('/verify-login', loginLimiter, verifyLoginOtp);

router.post('/google', googleLogin); 

router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resetToken', resetPassword);

router.get('/check-session', protect, (req, res) => {
  res.status(200).json({ status: 'active', user: req.user });
});

module.exports = router;