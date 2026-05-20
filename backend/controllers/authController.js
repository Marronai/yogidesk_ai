const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const geoip = require('geoip-lite');
const { createClient } = require('@supabase/supabase-js');

const { sendDirectBrandMail } = require('../services/mailService');
const { getWelcomeEmailHTML } = require('../utils/emailTemplates');

// Initialize Supabase Client for OTP management
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

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

// 🛠️ HELPER: Token Generator (Fallback safe)
const generateToken = (userOrId) => {
  const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
  const payload = typeof userOrId === 'object'
    ? {
        id: userOrId._id,
        email: userOrId.email,
        role: userOrId.role,
        name: userOrId.name
      }
    : {
        id: userOrId
      };
  return jwt.sign(payload, secret, { expiresIn: '30d' });
};

// 🛠️ HELPER: Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 1️⃣ REGISTER: Send OTP to email, set isVerified: false
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, businessName, businessType, businessCategory } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ msg: "Please provide name, email, and password" });
    }

    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create new user
    user = await User.create({
      name,
      email,
      password,
      phone: phone || '',
      businessName: businessName || `${name}'s Clinic`,
      businessType: businessType || 'Clinic',
      businessCategory: businessCategory || 'Clinic',
      role: 'user',
      planType: 'starter_clinic',
      subscriptionStatus: 'wallet_active',
      wallet: { balance: 50, is_first_recharge: true },
      isVerified: false,
      otp,
      otpExpires
      // currentSessionId: crypto.randomBytes(16).toString('hex')
    });

    const welcomeHTML = getWelcomeEmailHTML(name);

    sendOTP(user.email, user.name, otp)
      .catch(err => console.error("Background OTP Mailer Error Trace:", err.message));

    res.once('finish', () => {
      setImmediate(() => {
        void sendDirectBrandMail(email, "Welcome to Yogi Desk AI! 🚀", welcomeHTML, 'onboarding');
      });
    });

    res.status(200).json({
      success: true,
      msg: 'User registered. Please check your email for OTP verification.'
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

// 2️⃣ LOGIN STEP 1: Verify email/password, send OTP
exports.loginStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
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

// 3️⃣ VERIFY OTP: Verify OTP and issue JWT
exports.verifyOTP = async (req, res) => {
  try {
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

    // Clear OTP and verify user
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    // user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    const token = generateToken(user);
    const userPayload = buildUserPayload(user);
    const welcomeHTML = getWelcomeEmailHTML(user.name);

    res.once('finish', () => {
      setImmediate(() => {
        void sendDirectBrandMail(user.email, "Welcome to Yogi Desk AI! 🚀", welcomeHTML, 'onboarding');
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
      sendWelcomeEmail(user.email, user.name, user.businessName);
    }

    // user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

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
