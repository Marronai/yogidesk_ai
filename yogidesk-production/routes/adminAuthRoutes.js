const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const emailConfig = require('../config/emailConfig');

const router = express.Router();

const sendOTP = typeof emailConfig.sendOTP === 'function'
  ? emailConfig.sendOTP
  : async () => false;

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many admin login attempts. Please try again after 15 minutes.' },
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const generateAdminToken = (user) => {
  const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      portal: 'admin',
    },
    secret,
    { expiresIn: '8h' }
  );
};

router.post('/login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: 'Please provide email and password.' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Admin access only.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials.' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    const otpSent = await sendOTP(user.email, user.name, otp);
    if (!otpSent) {
      return res.status(500).json({ msg: 'Failed to send admin OTP. Please try again.' });
    }

    res.json({ success: true, msg: 'Admin OTP sent to your email.' });
  } catch (error) {
    console.error('Admin login error:', error.message);
    res.status(500).json({ msg: 'Admin login failed.' });
  }
});

router.post('/verify-login', adminLoginLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ msg: 'Please provide email and OTP.' });
    }

    const user = await User.findOne({ email }).select('+otp +otpExpires');

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Admin access only.' });
    }

    if (!user.otp || user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ msg: 'Invalid or expired OTP.' });
    }

    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    await user.save();

    res.json({
      success: true,
      token: generateAdminToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Admin OTP verification error:', error.message);
    res.status(500).json({ msg: 'Admin OTP verification failed.' });
  }
});

module.exports = router;
