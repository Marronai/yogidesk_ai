const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

let passport = null;
let jwt = null;
const logOptionalAuthWarning = (message) => {
  if (process.env.AUTH_OPTIONAL_WARNINGS === 'true') console.warn(message);
};
try {
  passport = require('passport');
} catch (error) {
  logOptionalAuthWarning('[YogiDesk Auth] Optional passport package is not installed. Google OAuth routes are disabled until passport is installed.');
}
try {
  jwt = require('jsonwebtoken');
} catch (error) {
  logOptionalAuthWarning('[YogiDesk Auth] jsonwebtoken package is not installed. Google OAuth callback JWT creation is disabled until jsonwebtoken is installed.');
}

const { 
  register, 
  loginStep1, 
  verifyOTP,
  verifySignupOTP,
  requestEmailOTP,
  verifyEmailOTP,
  verifyPhoneOTP,
  googleLogin,
  sendWhatsAppOTP,
  verifyWhatsAppOTP
} = require('../controllers/authController');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many login attempts. Please try again after 15 minutes.' }
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many signup attempts. Please try again after 15 minutes.' }
});

let protect = (req, res) => res.status(503).json({
  success: false,
  msg: 'Session middleware is unavailable because auth dependencies are missing.'
});
try {
  ({ protect } = require('../middleware/authMiddleware'));
} catch (error) {
  logOptionalAuthWarning('[YogiDesk Auth] Optional auth middleware failed to load. /check-session is disabled until auth dependencies are restored.');
}

// 🛠️ DEVELOPER TIP: Abhi ke liye Rate Limiters ko hata dete hain 
// kyunki testing mein ye bar-bar block kar dete hain (405/429 error)
// const loginLimiter = rateLimit({ ... }); 

// --- SIGNUP & LOGIN ROUTES ---
// 🚀 'createAccountLimiter' hata diya taaki testing mein block na ho
router.post('/register', signupLimiter, register);
router.post('/signup', signupLimiter, register);
router.post('/login', loginLimiter, loginStep1);
router.post('/verify-login', loginLimiter, verifyOTP);
router.post('/verify-signup-otp', loginLimiter, verifySignupOTP);
router.post('/request-email-otp', loginLimiter, requestEmailOTP);
router.post('/verify-email-otp', loginLimiter, verifyEmailOTP);
router.post('/verify-phone-otp', loginLimiter, verifyPhoneOTP);

// --- WHATSAPP OTP AUTH ROUTES ---
router.post('/send-whatsapp-otp', loginLimiter, sendWhatsAppOTP);
router.post('/verify-whatsapp-otp', loginLimiter, verifyWhatsAppOTP);

// --- GOOGLE AUTH ROUTES ---
router.post('/google', googleLogin);

const requirePassport = (req, res, next) => {
  if (!passport?.authenticate || !jwt?.sign) {
    return res.status(503).json({
      success: false,
      msg: 'Google OAuth is unavailable because passport/jsonwebtoken packages are not installed on this server.'
    });
  }
  return next();
};

const runGooglePassport = (options) => (req, res, next) => passport.authenticate('google', options)(req, res, next);

// 1. Google par redirect
router.get('/google', requirePassport, runGooglePassport({ scope: ['profile', 'email'] }));

// 2. Google callback with JWT Token ✅
router.get('/google/callback', 
    requirePassport,
    runGooglePassport({ 
        failureRedirect: 'https://yogidesk-ai.com/login?error=google_auth_failed',
        session: false 
    }),
    (req, res) => {
        try {
            // ✅ JWT_SECRET agar .env mein na mile toh bypass secret use karein
            const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
            const issuedAt = Math.floor(Date.now() / 1000) - 60;
            
            const token = jwt.sign(
                { 
                    id: req.user._id, 
                    email: req.user.email,
                    role: req.user.role || 'doctor',
                    name: req.user.name,
                    iat: issuedAt
                },
                secret,
                { expiresIn: '30d' }
            );

            // ✅ Frontend redirect
            res.redirect(`https://yogidesk-ai.com/auth-success?token=${token}`);
        } catch (error) {
            console.error('❌ Google callback error:', error);
            res.redirect('https://yogidesk-ai.com/login?error=auth_failed');
        }
    }
);

// --- PROTECTED ROUTES ---
router.get('/check-session', protect, (req, res) => {
  res.status(200).json({ status: 'active', user: req.user });
});

module.exports = router;
