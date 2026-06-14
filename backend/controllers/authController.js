let User = null;
let jwt = null;
const logOptionalAuthWarning = (message) => {
  if (process.env.AUTH_OPTIONAL_WARNINGS === 'true') console.warn(message);
};
try {
  User = require('../models/User');
} catch (error) {
  logOptionalAuthWarning('[YogiDesk Auth] Optional Mongo User model is missing. Mongo-backed auth routes are disabled until backend/models/User.js is restored.');
}
try {
  jwt = require('jsonwebtoken');
} catch (error) {
  logOptionalAuthWarning('[YogiDesk Auth] jsonwebtoken package is missing. JWT issuing routes are disabled until jsonwebtoken is installed.');
}
const crypto = require('crypto');
const axios = require('axios');
const { supabase, supabaseAdmin } = require('../config/supabase');
let geoip = null;
try {
  geoip = require('geoip-lite');
} catch (error) {
  logOptionalAuthWarning('[YogiDesk Auth] Optional geoip-lite package is missing. Login location enrichment is disabled.');
}

const { sendDirectBrandMail } = require('../services/mailService');
const { getWelcomeEmailHTML } = require('../utils/emailTemplates');
const { ensurePremiumTrialProfile } = require('../services/trialService');
const {
  ensureMetaReviewerAccount,
  isMetaReviewerEmail,
} = require('../services/metaReviewerAccountService');

const runSupabaseOperation = async (operationPromise) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Supabase Client Timeout')), 4000);
  });

  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } catch (error) {
    console.error("Supabase Operation Failure Trace:", error.message);
    throw error;
  }
};

const emailConfig = require('../config/emailConfig');
const sendOTP = typeof emailConfig.sendOTP === 'function'
  ? emailConfig.sendOTP
  : async () => {
      console.error('❌ OTP email helper is unavailable.');
      return false;
    };
const sendWelcomeEmail = typeof emailConfig.sendWelcomeEmail === 'function'
  ? emailConfig.sendWelcomeEmail
  : async () => {
      console.error('❌ Welcome email helper is unavailable.');
      return false;
    };
const sendLoginAlert = typeof emailConfig.sendLoginAlert === 'function'
  ? emailConfig.sendLoginAlert
  : async () => {
      console.error('❌ Login alert email helper is unavailable.');
      return false;
    };

const buildUserPayload = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified,
  businessName: user.businessName,
  businessCategory: user.businessCategory,
  planType: user.planType,
  subscriptionStatus: user.subscriptionStatus,
  wallet: user.wallet || { balance: 50, is_first_recharge: true }
});

const requireMongoUserModel = (res) => {
  if (User) return true;
  res.status(503).json({
    success: false,
    msg: 'Mongo-backed auth is unavailable because backend/models/User.js is missing.'
  });
  return false;
};

// 🛠️ HELPER: Token Generator (Fallback safe)
const generateToken = (userOrId) => {
  if (!jwt?.sign) throw new Error('JWT service unavailable. Install jsonwebtoken.');
  const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
  const issuedAt = Math.floor(Date.now() / 1000) - 60;
  const payload = typeof userOrId === 'object'
    ? {
        id: userOrId._id,
        email: userOrId.email,
        role: userOrId.role,
        name: userOrId.name,
        iat: issuedAt
      }
    : {
        id: userOrId,
        iat: issuedAt
      };
  return jwt.sign(payload, secret, { expiresIn: '30d' });
};
const SUPERADMIN_SHADOW_TOKEN_PREFIX = 'superadmin-shadow-token-';
const getSuperadminShadowSecret = () => (
  process.env.SUPERADMIN_SHADOW_SECRET ||
  process.env.JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'yogidesk-superadmin-shadow-secret'
);
const base64Url = (value) => Buffer.from(value).toString('base64url');
const signSuperadminShadowPayload = (payload) => {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getSuperadminShadowSecret())
    .update(body)
    .digest('base64url');
  return `${SUPERADMIN_SHADOW_TOKEN_PREFIX}${body}.${signature}`;
};
const timingSafeSecretMatch = (left = '', right = '') => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

// 🛠️ HELPER: Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const emailOtpStore = new Map();
const phoneOtpStore = new Map();
const signupVerificationStore = new Map();
const MONTHLY_SMS_OTP_CAP = Number(process.env.AUTH_SMS_OTP_MONTHLY_CAP || 40);
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const buildEmailOtpKey = (email, purpose = 'auth') => `${normalizeEmail(email)}:${String(purpose || 'auth').trim().toLowerCase()}`;
const normalizePurpose = (purpose = 'auth') => String(purpose || 'auth').trim().toLowerCase();
const normalizePhoneDigits = (phone) => String(phone || '').replace(/\D/g, '');
const normalizePhoneE164 = (phone) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return '';
  if (String(phone || '').trim().startsWith('+')) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
};
const buildPhoneOtpKey = (phone, purpose = 'auth') => `${normalizePhoneE164(phone)}:${normalizePurpose(purpose)}`;
const sanitizeProfileChoice = (value, fallback = '') => String(value || fallback || '')
  .replace(/[\u0000-\u001F\u007F<>`$]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 80);

const clearExpiredEmailOtps = () => {
  const now = Date.now();
  for (const [key, record] of emailOtpStore.entries()) {
    if (!record?.expiresAt || record.expiresAt <= now) emailOtpStore.delete(key);
  }
};

const isMissingColumnError = (error) => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const getMissingSchemaColumn = (error) => {
  const message = String(error?.message || error?.details || '');
  return message.match(/'([^']+)'\s+column/i)?.[1] || message.match(/column\s+"([^"]+)"/i)?.[1] || '';
};

const updateDoctorProfileSafely = async ({ userId, payload }) => {
  if (!supabase?.from || !userId || !payload || Object.keys(payload).length === 0) return false;
  let nextPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  const removedColumns = new Set();

  while (Object.keys(nextPayload).length > 0) {
    const { error } = await supabase.from('doctor_profiles').update(nextPayload).eq('id', userId);
    if (!error) return true;

    const missingColumn = getMissingSchemaColumn(error);
    if (isMissingColumnError(error) && missingColumn && Object.prototype.hasOwnProperty.call(nextPayload, missingColumn) && !removedColumns.has(missingColumn)) {
      removedColumns.add(missingColumn);
      const { [missingColumn]: _removed, ...strippedPayload } = nextPayload;
      nextPayload = strippedPayload;
      continue;
    }

    console.error('[HybridAuth] doctor_profiles update deferred.');
    return false;
  }

  return false;
};

const clearExpiredPhoneOtps = () => {
  const now = Date.now();
  for (const [key, record] of phoneOtpStore.entries()) {
    if (!record?.expiresAt || record.expiresAt <= now) phoneOtpStore.delete(key);
  }
  for (const [key, record] of signupVerificationStore.entries()) {
    if (!record?.expiresAt || record.expiresAt <= now) signupVerificationStore.delete(key);
  }
};

const storeEmailOtp = async ({ email, name, purpose }) => {
  const safeEmail = normalizeEmail(email);
  const safePurpose = normalizePurpose(purpose);
  const otp = generateOTP();

  emailOtpStore.set(buildEmailOtpKey(safeEmail, safePurpose), {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0
  });

  const sent = await sendOTP(safeEmail, name || 'Doctor', otp);
  if (!sent) throw new Error('Failed to send email OTP.');
  return { channel: 'email', target: 'email' };
};

const verifyStoredEmailOtp = ({ email, purpose, otp }) => {
  clearExpiredEmailOtps();
  const safeEmail = normalizeEmail(email);
  const key = buildEmailOtpKey(safeEmail, purpose);
  const record = emailOtpStore.get(key);
  if (!record || record.expiresAt <= Date.now()) {
    emailOtpStore.delete(key);
    return { ok: false, status: 400, message: 'Invalid or expired OTP.' };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    emailOtpStore.delete(key);
    return { ok: false, status: 429, message: 'Too many OTP attempts. Please request a new code.' };
  }

  if (record.otp !== String(otp || '').trim()) {
    emailOtpStore.set(key, record);
    return { ok: false, status: 400, message: 'Invalid or expired OTP.' };
  }

  emailOtpStore.delete(key);
  return { ok: true };
};

const dispatchFirebasePhoneOtp = async ({ phone, purpose, email, recaptchaToken }) => {
  clearExpiredPhoneOtps();
  const safePhone = normalizePhoneE164(phone);
  const safePurpose = normalizePurpose(purpose);
  if (!safePhone) throw new Error('Phone number is required for SMS OTP.');

  console.log('[HybridAuth] Dispatching Firebase Phone OTP request.', {
    phone: safePhone.replace(/\d(?=\d{4})/g, '*'),
    purpose: safePurpose,
    hasBridge: Boolean(process.env.FIREBASE_PHONE_AUTH_WEBHOOK_URL),
    hasFirebaseApiKey: Boolean(process.env.FIREBASE_WEB_API_KEY),
    hasRecaptchaToken: Boolean(recaptchaToken)
  });

  if (process.env.FIREBASE_PHONE_AUTH_WEBHOOK_URL) {
    const { data } = await axios.post(process.env.FIREBASE_PHONE_AUTH_WEBHOOK_URL, {
      phoneNumber: safePhone,
      purpose: safePurpose,
      email
    }, {
      timeout: 12000,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.FIREBASE_PHONE_AUTH_WEBHOOK_SECRET
          ? { Authorization: `Bearer ${process.env.FIREBASE_PHONE_AUTH_WEBHOOK_SECRET}` }
          : {})
      }
    });
    return { channel: 'sms', target: 'phone', provider: 'firebase', verificationId: data?.verificationId || data?.sessionInfo || null };
  }

  if (process.env.FIREBASE_WEB_API_KEY && recaptchaToken) {
    const { data } = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${process.env.FIREBASE_WEB_API_KEY}`,
      { phoneNumber: safePhone, recaptchaToken },
      { timeout: 12000 }
    );
    return { channel: 'sms', target: 'phone', provider: 'firebase', verificationId: data?.sessionInfo || null };
  }

  const otp = generateOTP();
  phoneOtpStore.set(buildPhoneOtpKey(safePhone, safePurpose), {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0
  });
  console.warn('[HybridAuth] Firebase phone dispatch bridge is not configured. Stored local fallback phone OTP for development.', {
    phone: safePhone.replace(/\d(?=\d{4})/g, '*'),
    purpose: safePurpose
  });
  return { channel: 'sms', target: 'phone', provider: 'local_fallback', devOtp: process.env.NODE_ENV === 'production' ? undefined : otp };
};

const verifyStoredPhoneOtp = ({ phone, purpose, otp, firebaseIdToken }) => {
  clearExpiredPhoneOtps();
  if (firebaseIdToken) return { ok: true, provider: 'firebase_id_token' };

  const safePhone = normalizePhoneE164(phone);
  const key = buildPhoneOtpKey(safePhone, purpose);
  const record = phoneOtpStore.get(key);
  if (!record || record.expiresAt <= Date.now()) {
    phoneOtpStore.delete(key);
    return { ok: false, status: 400, message: 'Invalid or expired phone OTP.' };
  }

  record.attempts += 1;
  if (record.attempts > 5) {
    phoneOtpStore.delete(key);
    return { ok: false, status: 429, message: 'Too many phone OTP attempts. Please request a new code.' };
  }

  if (record.otp !== String(otp || '').trim()) {
    phoneOtpStore.set(key, record);
    return { ok: false, status: 400, message: 'Invalid or expired phone OTP.' };
  }

  phoneOtpStore.delete(key);
  return { ok: true };
};

const readDoctorProfileByIdentifier = async (identifier) => {
  const db = supabase;
  const raw = String(identifier || '').trim();
  if (!db?.from || !raw) return null;

  const email = normalizeEmail(raw);
  const phoneDigits = normalizePhoneDigits(raw);
  const phoneE164 = normalizePhoneE164(raw);
  const filters = [];
  if (email.includes('@')) filters.push(`email.eq.${email}`);
  if (phoneDigits) {
    filters.push(`phone.eq.${phoneDigits}`, `phone_number.eq.${phoneDigits}`, `phone_number.eq.${phoneE164}`, `mobile.eq.${phoneDigits}`);
  }

  if (!filters.length) return null;
  const { data, error } = await db.from('doctor_profiles').select('*').or(filters.join(',')).limit(1).maybeSingle();
  if (error) {
    console.error('[HybridAuth] Supabase profile lookup failed:', error.message || error);
    return null;
  }
  return data || null;
};

const incrementMonthlyOtpCount = async (profile) => {
  if (!supabase?.from || !profile?.id) return;
  const nextCount = Number(profile.otp_count_this_month || profile.auth_count || 0) + 1;
  await updateDoctorProfileSafely({
    userId: profile.id,
    payload: {
      otp_count_this_month: nextCount,
      auth_count: nextCount,
      last_otp_requested_at: new Date().toISOString()
    }
  });
};

exports.requestEmailOTP = async (req, res) => {
  try {
    console.log('[HybridAuth] /request-email-otp invoked.', {
      hasIdentifier: Boolean(req.body?.identifier || req.body?.email || req.body?.phone),
      purpose: req.body?.purpose || 'auth'
    });
    clearExpiredEmailOtps();
    clearExpiredPhoneOtps();

    const identifier = req.body?.identifier || req.body?.email || req.body?.phone;
    const purpose = normalizePurpose(req.body?.purpose || 'login');
    const requestedEmail = normalizeEmail(req.body?.email || identifier);
    if (purpose === 'login' && isMetaReviewerEmail(requestedEmail)) {
      return res.status(200).json({
        success: true,
        bypassOtp: true,
        msg: 'OTP bypassed for staging evaluation account.'
      });
    }

    const profile = await readDoctorProfileByIdentifier(identifier);

    if (!profile) {
      const email = normalizeEmail(req.body?.email || identifier);
      if (!email) return res.status(404).json({ success: false, msg: 'Doctor profile not found.' });
      console.warn('[HybridAuth] Profile not found; routing OTP to provided email as compatibility fallback.', { email });
      const result = await storeEmailOtp({ email, name: req.body?.name || 'Doctor', purpose });
      return res.status(200).json({ success: true, ...result, msg: 'OTP sent to your email.' });
    }

    const monthlyCount = Number(profile.otp_count_this_month || profile.auth_count || 0);
    const profileEmail = normalizeEmail(profile.email || req.body?.email);
    const profilePhone = profile.phone_number || profile.phone || profile.mobile || req.body?.phone;
    const requestedEmailFlow = Boolean(requestedEmail && requestedEmail.includes('@'));

    if (!requestedEmailFlow && monthlyCount < MONTHLY_SMS_OTP_CAP && profilePhone) {
      try {
        const result = await dispatchFirebasePhoneOtp({
          phone: profilePhone,
          purpose,
          email: profileEmail,
          recaptchaToken: req.body?.recaptchaToken
        });
        await incrementMonthlyOtpCount(profile);
        return res.status(200).json({
          success: true,
          ...result,
          count: monthlyCount + 1,
          cap: MONTHLY_SMS_OTP_CAP,
          msg: 'OTP sent to phone number.'
        });
      } catch (smsError) {
        console.error('[HybridAuth] Firebase phone OTP failed; routing to email fallback.', smsError.message || smsError);
      }
    }

    if (!profileEmail) return res.status(400).json({ success: false, msg: 'Registered email is required for OTP fallback.' });
    const result = await storeEmailOtp({ email: profileEmail, name: profile.name || 'Doctor', purpose });
    return res.status(200).json({
      success: true,
      ...result,
      count: monthlyCount,
      cap: MONTHLY_SMS_OTP_CAP,
      msg: monthlyCount >= MONTHLY_SMS_OTP_CAP
        ? 'Monthly SMS OTP cap reached. OTP sent to email.'
        : 'OTP sent to email.'
    });
  } catch (error) {
    console.error('[HybridAuth] Email/SMS OTP request error:', error.message || error);
    return res.status(500).json({ success: false, msg: 'Unable to send OTP.' });
  }
};

exports.verifyEmailOTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || req.body?.identifier);
    const phone = normalizePhoneE164(req.body?.phone || req.body?.identifier);
    const purpose = normalizePurpose(req.body?.purpose || 'login');
    const otp = String(req.body?.otp || req.body?.emailOtp || req.body?.phoneOtp || '').trim();
    const channel = String(req.body?.channel || '').trim().toLowerCase();
    const firebaseIdToken = String(req.body?.firebaseIdToken || req.body?.firebase_id_token || '').trim();

    if ((channel === 'sms' || firebaseIdToken || (phone && !email.includes('@'))) && (otp || firebaseIdToken)) {
      const verification = verifyStoredPhoneOtp({ phone, purpose, otp, firebaseIdToken });
      if (!verification.ok) return res.status(verification.status).json({ success: false, msg: verification.message });
      return res.status(200).json({ success: true, channel: 'sms', msg: 'Phone OTP verified.' });
    }

    if (!email || !otp) return res.status(400).json({ success: false, msg: 'Email and OTP are required' });

    const verification = verifyStoredEmailOtp({ email, purpose, otp });
    if (!verification.ok) return res.status(verification.status).json({ success: false, msg: verification.message });
    return res.status(200).json({ success: true, msg: 'OTP verified.' });
  } catch (error) {
    console.error('[HybridAuth] Email OTP verification error:', error.message || error);
    return res.status(500).json({ success: false, msg: 'Unable to verify OTP.' });
  }
};

exports.verifyPhoneOTP = async (req, res) => {
  try {
    const phone = normalizePhoneE164(req.body?.phone || req.body?.identifier);
    const purpose = normalizePurpose(req.body?.purpose || 'login');
    const otp = String(req.body?.otp || req.body?.phoneOtp || '').trim();
    const firebaseIdToken = String(req.body?.firebaseIdToken || req.body?.firebase_id_token || '').trim();

    if (!phone || (!otp && !firebaseIdToken)) {
      return res.status(400).json({ success: false, msg: 'Phone and OTP/Firebase token are required' });
    }

    const verification = verifyStoredPhoneOtp({ phone, purpose, otp, firebaseIdToken });
    if (!verification.ok) return res.status(verification.status).json({ success: false, msg: verification.message });
    return res.status(200).json({ success: true, channel: 'sms', msg: 'Phone OTP verified.' });
  } catch (error) {
    console.error('[HybridAuth] Phone OTP verification error:', error.message || error);
    return res.status(500).json({ success: false, msg: 'Unable to verify phone OTP.' });
  }
};

// 🛠️ HELPER: Silent activity logging
const logDoctorActivity = async (userId) => {
  if (!userId) return;
  try {
    const now = new Date().toISOString();
    // Update local DB if needed (Assuming last_login_at exists in schema)
    await User.findByIdAndUpdate(userId, { last_login_at: now }).catch(() => {});
    
    // Mirror to Supabase Analytical Profile
    if (supabase) {
      await supabase
        .from('doctor_profiles')
        .update({ last_login_at: now })
        .eq('id', userId)
        .catch(err => console.error("Activity Log Error:", err.message));
    }
  } catch (err) {
    // Fail silently to avoid interrupting doctor workflow
  }
};

// 1️⃣ REGISTER: Send OTP to both email and phone, keep account pending until both verify
exports.register = async (req, res) => {
  try {
    if (!requireMongoUserModel(res)) return;
    const { name, email, password, phone, businessName, businessType, businessCategory, specialization } = req.body;
    const safeEmail = normalizeEmail(email);
    const safePhone = normalizePhoneE164(phone);
    const selectedSpecialization = sanitizeProfileChoice(specialization || businessCategory || businessType);
    const selectedBusinessType = sanitizeProfileChoice(businessType, 'Clinic') || 'Clinic';

    console.log('[HybridAuth] Signup requested.', {
      email: safeEmail,
      hasPhone: Boolean(safePhone),
      hasRecaptchaToken: Boolean(req.body?.recaptchaToken)
    });

    if (!name || !safeEmail || !password || !safePhone) {
      return res.status(400).json({ msg: "Please provide name, email, password, and phone" });
    }

    let user = await User.findOne({ email: safeEmail });

    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const emailOtp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    user = await User.create({
      name,
      email: safeEmail,
      password,
      phone: safePhone,
      businessName: businessName || `${name}'s Clinic`,
      businessType: selectedBusinessType,
      businessCategory: selectedSpecialization,
      role: 'user',
      planType: 'growth',
      subscriptionStatus: 'wallet_active',
      wallet: { balance: 50, is_first_recharge: true },
      isVerified: false,
      otp: emailOtp,
      otpExpires
      // currentSessionId: crypto.randomBytes(16).toString('hex')
    });

    try {
      const { error: trialSeedError } = await ensurePremiumTrialProfile(supabase, {
        userId: String(user._id),
        email: safeEmail,
        name,
        businessName: businessName || `${name}'s Clinic`,
        businessCategory: selectedSpecialization,
        phone: safePhone
      });
      if (trialSeedError) console.error('[YogiDesk Secure Trial] Premium trial profile seed deferred.');
    } catch {
      console.error('[YogiDesk Secure Trial] Premium trial profile seed deferred.');
    }

    await updateDoctorProfileSafely({
      userId: String(user._id),
      payload: {
        account_status: 'PENDING_VERIFICATION',
        status: 'PENDING_VERIFICATION',
        email_otp_verified: false,
        phone_otp_verified: false,
        phone_number: safePhone,
        phone: normalizePhoneDigits(safePhone),
        specialization: selectedSpecialization,
        business_category: selectedSpecialization,
        clinic_category: selectedSpecialization,
        subscription_tier: 'growth',
        current_plan: 'growth',
        plan_tier: 'growth',
        lifetime_patients_limit: 2000,
        ai_message_balance: 500,
        ai_token_balance: 500,
        plan_limits: { patient_limit: 2000, staff_limit: 2, template_limit: 50 },
        updated_at: new Date().toISOString()
      }
    });

    const welcomeHTML = getWelcomeEmailHTML(name);

    const [emailResult, phoneResult] = await Promise.allSettled([
      storeEmailOtp({ email: safeEmail, name, purpose: 'signup' }),
      dispatchFirebasePhoneOtp({
        phone: safePhone,
        purpose: 'signup',
        email: safeEmail,
        recaptchaToken: req.body?.recaptchaToken
      })
    ]);

    if (emailResult.status === 'rejected' || phoneResult.status === 'rejected') {
      console.error('[HybridAuth] Signup OTP dispatch failure.', {
        emailError: emailResult.reason?.message || null,
        phoneError: phoneResult.reason?.message || null
      });
      return res.status(500).json({
        success: false,
        msg: 'Unable to send both signup OTPs. Please try again.'
      });
    }

    signupVerificationStore.set(safeEmail, {
      userId: String(user._id),
      phone: safePhone,
      emailVerified: false,
      phoneVerified: false,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    res.once('finish', () => {
      setImmediate(() => {
        void sendDirectBrandMail(safeEmail, "Welcome to Yogi Desk AI - Your Premium Growth Trial is Active", welcomeHTML, 'onboarding');
      });
    });

    res.status(200).json({
      success: true,
      step: "verify_both",
      message: "OTP sent to both email and phone number",
      msg: "OTP sent to both email and phone number",
      email: safeEmail,
      phone: safePhone,
      channels: {
        email: emailResult.value,
        phone: phoneResult.value
      }
    });
  } catch (error) {
    console.error('[HybridAuth] Signup route failed:', error.message || error);
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

// 2️⃣ LOGIN STEP 1: Verify email/password, send OTP
exports.loginStep1 = async (req, res) => {
  try {
    if (!requireMongoUserModel(res)) return;
    const { email, password } = req.body;
    const safeEmail = normalizeEmail(email);

    if (!email || !password) {
      return res.status(400).json({ msg: 'Please provide email and password' });
    }

    if (isMetaReviewerEmail(safeEmail)) {
      await ensureMetaReviewerAccount({ db: supabase, User }).catch((error) => {
        console.warn('[Meta Reviewer Seed] Auth-time seed deferred:', error.message || error);
      });
    }

    const user = await User.findOne({ email: safeEmail }).select('+password');

    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    if (isMetaReviewerEmail(safeEmail)) {
      user.otp = undefined;
      user.otpExpires = undefined;
      user.isVerified = true;
      await user.save();
      logDoctorActivity(user._id);

      const metaReviewerTokenSubject = {
        _id: user._id,
        email: user.email,
        role: 'doctor',
        name: user.name
      };
      const token = generateToken(metaReviewerTokenSubject);
      const userPayload = { ...buildUserPayload(user), role: 'doctor' };

      return res.status(200).json({
        success: true,
        message: 'Authentication verified cleanly via Staging Evaluation Loop.',
        token,
        user: userPayload
      });
    }

    // Generate OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send OTP email
    const otpSent = await sendOTP(user.email, user.name, otp);
    
    if (!otpSent) {
      return res.status(500).json({ msg: 'Failed to send OTP. Please try again.' });
    }

    res.status(200).json({
      success: true,
      msg: 'Credentials verified. Please check your email for OTP.'
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

exports.masterKeyLogin = async (req, res) => {
  try {
    const db = supabaseAdmin || supabase;
    const masterKey = String(req.body?.masterKey || req.body?.password || '').trim();
    const targetEmail = normalizeEmail(req.body?.email || req.body?.targetEmail);
    const configuredKey = String(process.env.SUPERADMIN_MASTER_KEY_PASSWORD || '').trim();

    if (!configuredKey) {
      return res.status(503).json({ success: false, message: 'Master key login is not configured.' });
    }
    if (!targetEmail || !masterKey || !timingSafeSecretMatch(masterKey, configuredKey)) {
      return res.status(401).json({ success: false, message: 'Invalid master key request.' });
    }
    if (!db?.from) return res.status(500).json({ success: false, message: 'Database connection unavailable.' });

    let targetUser = null;
    if (db?.auth?.admin?.listUsers) {
      const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      targetUser = (data?.users || []).find((user) => normalizeEmail(user.email) === targetEmail) || null;
    }

    let { data: profile, error: profileError } = await db
      .from('doctor_profiles')
      .select('id,email,name,clinic_name')
      .eq('email', targetEmail)
      .limit(1)
      .maybeSingle();
    if (profileError && !['PGRST116', '42P01', '42703', 'PGRST204', 'PGRST205'].includes(profileError.code)) throw profileError;
    if (!profile?.id && targetUser?.id) {
      const profileById = await db
        .from('doctor_profiles')
        .select('id,email,name,clinic_name')
        .eq('id', targetUser.id)
        .limit(1)
        .maybeSingle();
      if (profileById.error && !['PGRST116', '42P01', '42703', 'PGRST204', 'PGRST205'].includes(profileById.error.code)) throw profileById.error;
      profile = profileById.data || null;
    }

    const targetUserId = targetUser?.id || profile?.id;
    if (!targetUserId) return res.status(404).json({ success: false, message: 'Target doctor account not found.' });

    const clinicFilters = [
      (query) => query.eq('user_id', targetUserId),
      (query) => query.eq('doctor_id', targetUserId),
      (query) => query.eq('owner_id', targetUserId),
      (query) => query.eq('id', targetUserId),
    ];
    let clinic = null;
    for (const applyFilter of clinicFilters) {
      const { data, error } = await applyFilter(db.from('clinics').select('id,clinic_name,name')).limit(1).maybeSingle();
      if (!error && data?.id) {
        clinic = data;
        break;
      }
      if (error && !['PGRST116', '42P01', '42703', 'PGRST204', 'PGRST205'].includes(error.code)) throw error;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const token = signSuperadminShadowPayload({
      sub: targetUserId,
      clinic_id: clinic?.id || targetUserId,
      mode: 'superadmin_master_key_ghost_login',
      by: req.superadmin?.id || null,
      exp: Math.floor(new Date(expiresAt).getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
    });

    await db.from('superadmin_master_key_audit_logs').insert([{
      actor_user_id: req.superadmin?.id || null,
      actor_email: req.superadmin?.email || null,
      target_user_id: targetUserId,
      target_email: targetEmail,
      target_clinic_id: clinic?.id || null,
      ip_address: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim(),
      user_agent: req.headers['user-agent'] || null,
      event_type: 'MASTER_KEY_GHOST_LOGIN'
    }]).catch((error) => {
      console.error('Master key audit insert failed:', error.message || error);
    });

    return res.status(200).json({
      success: true,
      token,
      session: { access_token: token, expires_at: expiresAt },
      user: {
        id: targetUserId,
        email: targetEmail,
        role: 'doctor',
        name: profile?.name || targetUser?.user_metadata?.name || targetEmail,
      },
      clinic: {
        id: clinic?.id || targetUserId,
        name: clinic?.clinic_name || clinic?.name || profile?.clinic_name || 'Clinic Workspace',
      },
      audit: {
        mode: 'superadmin_master_key_ghost_login',
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Master key ghost login failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to complete master key login.' });
  }
};

// 3️⃣ VERIFY OTP: Verify OTP and issue JWT
exports.verifyOTP = async (req, res) => {
  try {
    if (!requireMongoUserModel(res)) return;
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ msg: 'Please provide email and OTP' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpires');

    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    if (!user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    await user.save();
    logDoctorActivity(user._id);

    const ipAddress = (req.headers['x-forwarded-for'] || req.ip || 'Unknown IP').split(',')[0].trim();
    const geo = ipAddress !== 'Unknown IP' ? geoip.lookup(ipAddress) : null;
    const location = geo ? [geo.city, geo.region, geo.country].filter(Boolean).join(', ') : 'Unknown Location';
    const deviceInfo = req.headers['user-agent'] || 'Unknown device';

    sendLoginAlert(user.email, user.name, `${deviceInfo} — ${location}`, ipAddress);

    const token = generateToken(user);
    const userPayload = buildUserPayload(user);

    res.status(200).json({
      success: true,
      token,
      user: userPayload
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

// 3.5️⃣ VERIFY SIGNUP OTP: Verify OTP for signup and issue JWT
exports.verifySignupOTP = async (req, res) => {
  try {
    if (!requireMongoUserModel(res)) return;
    const email = normalizeEmail(req.body?.email);
    const emailOtp = String(req.body?.emailOtp || req.body?.email_otp || req.body?.otp || '').trim();
    const phoneOtp = String(req.body?.phoneOtp || req.body?.phone_otp || req.body?.smsOtp || '').trim();
    const firebaseIdToken = String(req.body?.firebaseIdToken || req.body?.firebase_id_token || '').trim();
    const phone = normalizePhoneE164(req.body?.phone);

    console.log('[HybridAuth] Signup verification requested.', {
      email,
      hasEmailOtp: Boolean(emailOtp),
      hasPhoneOtp: Boolean(phoneOtp),
      hasFirebaseIdToken: Boolean(firebaseIdToken)
    });

    if (!email || !emailOtp || (!phoneOtp && !firebaseIdToken)) {
      return res.status(400).json({ msg: 'Please provide email OTP and phone OTP/Firebase token' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpires');

    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    const emailVerification = verifyStoredEmailOtp({ email, purpose: 'signup', otp: emailOtp });
    const legacyEmailOk = user.otp && user.otp === emailOtp && user.otpExpires >= Date.now();
    if (!emailVerification.ok && !legacyEmailOk) return res.status(emailVerification.status || 400).json({ msg: emailVerification.message || 'Invalid or expired email OTP' });

    const signupState = signupVerificationStore.get(email);
    const signupPhone = phone || signupState?.phone || user.phone;
    const phoneVerification = verifyStoredPhoneOtp({
      phone: signupPhone,
      purpose: 'signup',
      otp: phoneOtp,
      firebaseIdToken
    });
    if (!phoneVerification.ok) return res.status(phoneVerification.status || 400).json({ msg: phoneVerification.message || 'Invalid or expired phone OTP' });

    // Clear OTP and verify user
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    // user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();
    logDoctorActivity(user._id);
    signupVerificationStore.delete(email);

    await updateDoctorProfileSafely({
      userId: String(user._id),
      payload: {
        account_status: 'ACTIVE',
        status: 'ACTIVE',
        subscription_status: 'ACTIVE',
        email_otp_verified: true,
        phone_otp_verified: true,
        last_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });

    const token = generateToken(user);
    const userPayload = buildUserPayload(user);
    const welcomeHTML = getWelcomeEmailHTML(user.name);

    res.once('finish', () => {
      setImmediate(() => {
        void sendDirectBrandMail(user.email, "Welcome to Yogi Desk AI - Your Premium Growth Trial is Active", welcomeHTML, 'onboarding');
      });
    });

    res.status(200).json({
      success: true,
      token,
      message: "Login successful",
      user: userPayload
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

// 4️⃣ GOOGLE LOGIN: Direct token-based fallback
exports.googleLogin = async (req, res) => {
  try {
    if (!requireMongoUserModel(res)) return;
    const { access_token, tokenId } = req.body;
    const googleToken = access_token || tokenId;

    if (!googleToken) {
      return res.status(400).json({ msg: 'Missing Google token' });
    }

    const profileUrl = access_token
      ? `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${googleToken}`
      : `https://oauth2.googleapis.com/tokeninfo?id_token=${googleToken}`;

    const response = await axios.get(profileUrl);
    const profile = response.data;
    const email = profile.email;
    const name = profile.name || email.split('@')[0];
    const googleId = profile.sub || profile.user_id;
    const avatar = profile.picture || '';

    if (!email || !googleId) {
      return res.status(400).json({ msg: 'Invalid Google profile data' });
    }

    let user = await User.findOne({ email });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.avatar = avatar;
        user.isVerified = true;
      }
    } else {
      user = await User.create({
        name,
        email,
        googleId,
        avatar,
        password: crypto.randomBytes(16).toString('hex'),
        role: 'user',
        planType: 'starter_clinic',
        subscriptionStatus: 'wallet_active',
        wallet: { balance: 50, is_first_recharge: true },
        isVerified: true
        // currentSessionId: crypto.randomBytes(16).toString('hex')
      });
      await ensurePremiumTrialProfile(supabase, {
        userId: String(user._id),
        email,
        name,
        businessName: user.businessName || `${name}'s Clinic`,
        businessCategory: user.businessCategory || 'Clinic',
        phone: user.phone || ''
      }).then(({ error }) => {
        if (error) console.error('Google premium trial profile seed failed:', error.message || error);
      });
      sendWelcomeEmail(user.email, user.name, user.businessName);
    }

    // user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();
    logDoctorActivity(user._id);

    const token = generateToken(user);
    const userPayload = buildUserPayload(user);
    res.status(200).json({
      success: true,
      token,
      user: userPayload
    });
  } catch (error) {
    res.status(500).json({ msg: 'Google auth failed', error: error.message });
  }
};

// 7️⃣ SEND WHATSAPP OTP: Generate 6-digit numeric string and dispatch via Meta Cloud API
exports.sendWhatsAppOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ msg: "Phone number is required" });

    // Generate 6-digit numeric OTP and set 5-minute expiry
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const fullPhone = `91${phone.replace(/\D/g, '').slice(-10)}`;

    const { error: dbError } = await runSupabaseOperation(
      supabase.from('whatsapp_otps').insert([{
        phone_number: fullPhone,
        otp_code: otpCode,
        is_verified: false,
        expires_at: expiresAt
      }])
    );

    if (dbError) throw dbError;

    // 2. Dispatch Asynchronous Axios POST call to Meta's Cloud API
    const metaUrl = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    axios.post(metaUrl, {
      messaging_product: "whatsapp",
      to: fullPhone,
      type: "template",
      template: {
        name: "yogi_auth_otp",
        language: { code: "en_US" },
        components: [{
          type: "body",
          parameters: [{ type: "text", text: otpCode }]
        }]
      }
    }, {
      headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }
    }).catch(err => console.error("Meta OTP Dispatch Error:", err.response?.data || err.message));

    res.status(200).json({ success: true, msg: "OTP dispatched to WhatsApp" });
  } catch (error) {
    res.status(500).json({ msg: "Failed to dispatch WhatsApp OTP", error: error.message });
  }
};

// 8️⃣ VERIFY WHATSAPP OTP: Validate sequence and issue structural JWT
exports.verifyWhatsAppOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ msg: "Phone and OTP are required" });

    const fullPhone = `91${phone.replace(/\D/g, '').slice(-10)}`;
    const now = new Date().toISOString();

    const { data: record, error: queryError } = await runSupabaseOperation(
      supabase
        .from('whatsapp_otps')
        .select('*')
        .eq('phone_number', fullPhone)
        .eq('otp_code', otp)
        .eq('is_verified', false)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    );

    if (queryError || !record) {
      return res.status(401).json({ success: false, msg: "Invalid or expired OTP sequence" });
    }

    await runSupabaseOperation(
      supabase.from('whatsapp_otps').update({ is_verified: true }).eq('id', record.id)
    );

    const { data: profile, error: upsertError } = await runSupabaseOperation(
      supabase
        .from('doctor_profiles')
        .upsert({ phone_number: fullPhone, last_verified_at: now }, { onConflict: 'phone_number' })
        .select()
        .single()
    );

    if (upsertError) throw upsertError;

    // Sign custom JWT access token for persistence
    const token = generateToken({ 
      _id: profile.id, 
      phone: fullPhone, 
      role: 'doctor', 
      name: 'Yogi Verified Doctor' 
    });

    res.status(200).json({
      success: true,
      token,
      user: { id: profile.id, phone: fullPhone }
    });
  } catch (error) {
    res.status(500).json({ msg: "OTP verification process failed", error: error.message });
  }
};

// 9️⃣ INITIALIZE SUPER ADMIN: Hardlocked capacity (Max 2)
exports.initializeSuperAdmin = async (req, res) => {
  try {
    if (!requireMongoUserModel(res)) return;
    const { name, email, password, secretKey } = req.body;

    // Security secondary check
    if (secretKey !== process.env.SUPER_ADMIN_INIT_KEY) {
      return res.status(401).json({ msg: "Unauthorized initialization attempt" });
    }

    const adminCount = await User.countDocuments({ role: 'super_admin' });
    if (adminCount >= 2) {
      return res.status(403).json({ 
        success: false, 
        msg: "Initialization Hardlocked: Maximum Super Admin capacity reached." 
      });
    }

    const admin = await User.create({
      name,
      email,
      password,
      role: 'super_admin',
      isVerified: true,
      subscriptionStatus: 'active'
    });

    res.status(201).json({ success: true, msg: "Super Admin initialized successfully." });
  } catch (error) {
    res.status(500).json({ msg: "Admin Init Error", error: error.message });
  }
};
