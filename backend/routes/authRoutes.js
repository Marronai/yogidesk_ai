const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

const { 
  register, 
  loginStep1, 
  verifyOTP,
  googleLogin
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// 🛠️ DEVELOPER TIP: Abhi ke liye Rate Limiters ko hata dete hain 
// kyunki testing mein ye bar-bar block kar dete hain (405/429 error)
// const loginLimiter = rateLimit({ ... }); 

// --- SIGNUP & LOGIN ROUTES ---
// 🚀 'createAccountLimiter' hata diya taaki testing mein block na ho
router.post('/register', register);
router.post('/signup', register); 
router.post('/login', loginStep1);
router.post('/verify-otp', verifyOTP);

// --- GOOGLE AUTH ROUTES ---
router.post('/google', googleLogin);

// 1. Google par redirect
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. Google callback with JWT Token ✅
router.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: 'https://yogidesk-ai.com/login?error=google_auth_failed',
        session: false 
    }),
    (req, res) => {
        try {
            // ✅ JWT_SECRET agar .env mein na mile toh bypass secret use karein
            const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
            
            const token = jwt.sign(
                { 
                    id: req.user._id, 
                    email: req.user.email,
                    role: req.user.role || 'trial_user',
                    name: req.user.name
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