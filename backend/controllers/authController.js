const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const geoip = require('geoip-lite');

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

// 🛠️ HELPER: Trial countdown and user payload builder
const getTrialDaysRemaining = (user) => {
  const now = new Date();
  const expiry = user.planExpiryDate ? new Date(user.planExpiryDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const diff = expiry.getTime() - now.getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
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
  trialStartDate: user.trialStartDate,
  planExpiryDate: user.planExpiryDate,
  trialDaysRemaining: getTrialDaysRemaining(user)
});

// 🛠️ HELPER: Token Generator (Fallback safe)
const generateToken = (userOrId, sessionId) => {
  const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
  const payload = typeof userOrId === 'object'
    ? {
        id: userOrId._id,
        email: userOrId.email,
        role: userOrId.role,
        name: userOrId.name,
        ...(sessionId ? { sessionId } : {})
      }
    : {
        id: userOrId,
        ...(sessionId ? { sessionId } : {})
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
      businessName: businessName || `${name}'s Business`,
      businessType: businessType || 'Other',
      businessCategory: businessCategory || 'Other',
      role: 'admin',
      planType: 'free_trial',
      subscriptionStatus: 'trial',
      trialStartDate: new Date(),
      planExpiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      isVerified: false,
      otp,
      otpExpires
      // currentSessionId: crypto.randomBytes(16).toString('hex')
    });

    // Send OTP email
    const otpSent = await sendOTP(user.email, user.name, otp);
    
    if (!otpSent) {
      return res.status(500).json({ msg: 'Failed to send OTP. Please try again.' });
    }

    res.status(201).json({
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

    const token = generateToken(user, user.currentSessionId);
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

    // Send welcome email
    sendWelcomeEmail(user.email, user.name, user.businessName);

    const token = generateToken(user, user.currentSessionId);
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
        role: 'admin',
        planType: 'free_trial',
        subscriptionStatus: 'trial',
        trialStartDate: new Date(),
        planExpiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        isVerified: true
        // currentSessionId: crypto.randomBytes(16).toString('hex')
      });
      sendWelcomeEmail(user.email, user.name, user.businessName);
    }

    // user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    const token = generateToken(user, user.currentSessionId);
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

// ... baaki Google login same rahega