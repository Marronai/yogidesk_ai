const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');

// 🛠️ HELPER: Token Generator (Fallback safe)
const generateToken = (userOrId, sessionId) => {
  const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
  const payload = typeof userOrId === 'object'
    ? { id: userOrId._id, sessionId, email: userOrId.email, role: userOrId.role, name: userOrId.name }
    : { id: userOrId, sessionId };
  return jwt.sign(payload, secret, { expiresIn: '30d' });
};

// 1️⃣ REGISTER: Bypass Mode
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, businessName, businessType } = req.body;

    // Check if body data exists (Validation fix)
    if (!name || !email) {
      return res.status(400).json({ msg: "Please provide name and email" });
    }

    let user = await User.findOne({ email });

    if (user) {
      user.currentSessionId = crypto.randomBytes(16).toString('hex');
      await user.save();
      const token = generateToken(user, user.currentSessionId);
      return res.status(200).json({ 
        success: true, 
        token, 
        user: { id: user._id, name: user.name, email: user.email, role: user.role } 
      });
    }

    // Naya User (Saari fields ensure karein taaki validation fail na ho)
    user = await User.create({
      name,
      email,
      password: password || crypto.randomBytes(10).toString('hex'), // Default password if empty
      phone: phone || '0000000000',
      businessName: businessName || 'My Business',
      businessType: businessType || 'Other',
      role: 'trial_user',
      isVerified: true,
      currentSessionId: crypto.randomBytes(16).toString('hex')
    });

    const token = generateToken(user, user.currentSessionId);
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

// 2️⃣ LOGIN: Direct Bypass
exports.loginStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

    // Password match check
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    const token = generateToken(user, user.currentSessionId);
    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

// 2️⃣ OTP / VERIFY LOGIN FALLBACK (Direct Bypass)
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ msg: 'Please provide email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    const token = generateToken(user, user.currentSessionId);
    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ msg: 'Server Error', error: error.message });
  }
};

// 3️⃣ GOOGLE LOGIN: Direct token-based fallback
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
        role: 'trial_user',
        isVerified: true,
        currentSessionId: crypto.randomBytes(16).toString('hex')
      });
    }

    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    const token = generateToken(user, user.currentSessionId);
    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ msg: 'Google auth failed', error: error.message });
  }
};

// ... baaki Google login same rahega