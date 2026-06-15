const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { supabaseAdmin, supabase } = require('../config/supabase');
const emailConfig = require('../config/emailConfig');

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

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is completely missing!");
}

const JWT_SECRET = process.env.JWT_SECRET;

const { 
  register, 
  loginStep1, 
  masterKeyLogin,
  verifyOTP,
  verifySignupOTP,
  requestEmailOTP,
  verifyEmailOTP,
  verifyPhoneOTP,
  googleLogin,
  sendWhatsAppOTP,
  verifyWhatsAppOTP
} = require('../controllers/authController');
const { requireSuperadminMetadata } = require('../middleware/superadminGate');

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

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, msg: 'Too many password reset attempts. Please try again after 15 minutes.' }
});

const getBearerToken = (req) => {
  const header = String(req.headers.authorization || '').trim();
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const validateResetPassword = (password) => {
  const value = String(password || '');
  return {
    valid: value.length >= 8 && /[A-Z]/.test(value) && /[!@#$%^&*(),.?":{}|<>]/.test(value),
    message: 'Password must contain at least 8 characters, one uppercase letter, and one symbol.'
  };
};

const getPasswordFingerprint = (password) => {
  const secret = process.env.PASSWORD_REUSE_PEPPER || process.env.JWT_SECRET;
  return crypto.createHmac('sha256', secret).update(String(password || '')).digest('hex');
};
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
router.post('/master-key-login', loginLimiter, requireSuperadminMetadata, masterKeyLogin);
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

router.post('/confirm-password-reset', passwordResetLimiter, async (req, res) => {
  try {
    const token = getBearerToken(req);
    const password = String(req.body?.password || '');
    const validation = validateResetPassword(password);

    if (!token) {
      return res.status(401).json({ success: false, msg: 'Verified reset session is required.' });
    }
    if (!validation.valid) {
      return res.status(400).json({ success: false, msg: validation.message });
    }

    const client = supabaseAdmin || supabase;
    if (!client?.auth?.getUser || !client?.auth?.admin?.updateUserById) {
      return res.status(500).json({ success: false, msg: 'Secure password reset service is unavailable.' });
    }

    const { data: sessionData, error: sessionError } = await client.auth.getUser(token);
    const user = sessionData?.user;
    if (sessionError || !user?.id || !user?.email) {
      return res.status(401).json({ success: false, msg: 'Invalid or expired reset session.' });
    }

    const metadata = user.user_metadata || {};
    const appMetadata = user.app_metadata || {};
    const nextFingerprint = getPasswordFingerprint(password);
    if (appMetadata.password_fingerprint && appMetadata.password_fingerprint === nextFingerprint) {
      return res.status(409).json({
        success: false,
        msg: 'Please choose a new password that is different from your previous password.'
      });
    }

    const changedAt = new Date().toISOString();
    const { error: updateError } = await client.auth.admin.updateUserById(user.id, {
      password,
      app_metadata: {
        ...appMetadata,
        password_fingerprint: nextFingerprint,
        password_changed_at: changedAt,
      },
    });

    if (updateError) throw updateError;

    if (client?.from) {
      await client
        .from('doctor_profiles')
        .update({ password_changed_at: changedAt, updated_at: changedAt })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.warn('[YogiDesk Auth] Password changed profile timestamp skipped:', error.message || error);
        });
    }

    const displayName = metadata.full_name || metadata.name || 'Doctor';
    if (typeof emailConfig.sendPasswordChangedAlert === 'function') {
      await emailConfig.sendPasswordChangedAlert(user.email, displayName);
    }

    return res.status(200).json({ success: true, msg: 'Password Updated Successfully' });
  } catch (error) {
    console.error('Secure password reset failed:', error.message || error);
    return res.status(500).json({ success: false, msg: 'Unable to update password securely.' });
  }
});

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
            const issuedAt = Math.floor(Date.now() / 1000) - 60;
            
            const token = jwt.sign(
                { 
                    id: req.user._id, 
                    email: req.user.email,
                    role: req.user.role || 'doctor',
                    name: req.user.name,
                    iat: issuedAt
                },
                JWT_SECRET,
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
