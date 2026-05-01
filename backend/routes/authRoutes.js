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

// ✅✅✅ SIGNUP ROUTES (Both /register and /signup) ✅✅✅
router.post('/register', createAccountLimiter, register);
router.post('/signup', createAccountLimiter, register); // Alias for compatibility
router.post('/verify-signup', createAccountLimiter, verifySignupOtp);

// Login Routes
router.post('/login', loginLimiter, loginStep1);
router.post('/verify-login', loginLimiter, verifyLoginOtp);

// Google Login
router.post('/google', googleLogin); 

// Password Recovery
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resetToken', resetPassword);

// Protected Routes
router.get('/check-session', protect, (req, res) => {
  res.status(200).json({ status: 'active', user: req.user });
});

module.exports = router;
