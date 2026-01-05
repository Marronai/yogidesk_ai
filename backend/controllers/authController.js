const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

// Google Client Setup
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------------------------------------------
// 🛠️ HELPER: Token Generator
// ---------------------------------------------
const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("FATAL ERROR: JWT_SECRET is not defined.");
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// ---------------------------------------------
// 1️⃣ REGISTER USER (SIGNUP) + Welcome Email
// ---------------------------------------------
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, businessName, businessType } = req.body;

    // 1. Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // 2. Create User 
    // ⚠️ NOTE: Password yahan PLAIN text bhejo. User.js model ka 'pre-save' hook isse automatically hash karega.
    user = await User.create({
      name,
      email,
      password, // Plain password here
      phone,
      businessName,
      businessType,
      role: 'trial_user', // 🔒 SECURITY FIX: Default role trial user
      planType: 'free_trial'
    });

    // 3. 📧 SEND WELCOME EMAIL
    const message = `
      <h1>Welcome to Marroncorp! 🚀</h1>
      <p>Hi ${name},</p>
      <p>Thank you for starting your 5-Day Free Trial. We are excited to help you automate your business.</p>
      <p>Your account is now active.</p>
      <br>
      <p>Cheers,<br>Marroncorp Team</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Welcome to Marroncorp Family! 🎉',
        message: message,
      });
    } catch (emailError) {
      console.error("Welcome Email Failed:", emailError.message);
    }

    // 4. Generate Token
    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        planType: user.planType
      }
    });

  } catch (error) {
    console.error("Signup Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 2️⃣ LOGIN STEP 1: Verify Password & Send OTP
// ---------------------------------------------
exports.loginStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. User dhoondo (+password kyunki model me select: false hai)
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // 2. Google Account check
    if (user.googleId) {
      return res.status(400).json({ msg: 'Please use Google Login for this account.' });
    }

    // 3. Password Check (Model method)
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    // 4. Generate 6 Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 5. Save OTP to Database (Valid for 10 mins)
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 6. 📧 SEND OTP EMAIL
    const message = `
      <h2>Verify your Login</h2>
      <p>Your OTP for Marroncorp login is:</p>
      <h1 style="color: #FF6B00; letter-spacing: 5px;">${otp}</h1>
      <p>This code expires in 10 minutes.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your Login OTP - Marroncorp 🔒',
        message: message,
      });
    } catch (err) {
      return res.status(500).json({ msg: "Email could not be sent" });
    }

    res.status(200).json({ 
      success: true, 
      msg: 'OTP Sent to your email', 
      email: user.email,
      step: 2 // Frontend ko batao ki ab OTP maangna hai
    });

  } catch (error) {
    console.error("Login Step 1 Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 3️⃣ LOGIN STEP 2: Verify OTP & Give Token
// ---------------------------------------------
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // User dhoondo (+otp taaki hidden field mile)
    const user = await User.findOne({ email }).select('+otp +otpExpires');

    if (!user) {
      return res.status(400).json({ msg: 'User not found' });
    }

    // Validate OTP
    if (user.otp !== otp) {
      return res.status(400).json({ msg: 'Invalid OTP' });
    }

    // Check Expiry
    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ msg: 'OTP Expired. Please try login again.' });
    }

    // ✅ Success! Clear OTP & Send Token
    user.otp = undefined;
    user.otpExpires = undefined;
    
    // Generate New Session ID (Security Best Practice)
    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        planType: user.planType
      }
    });

  } catch (error) {
    console.error("Verify OTP Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 4️⃣ GOOGLE LOGIN (Direct Entry)
// ---------------------------------------------
exports.googleLogin = async (req, res) => {
  try {
    const { tokenId } = req.body; 

    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const { name, email, picture, sub } = ticket.getPayload();

    let user = await User.findOne({ email });

    if (user) {
      // Link existing user to Google if not already linked
      if (!user.googleId) {
        user.googleId = sub;
        user.avatar = picture;
        await user.save();
      }
    } else {
      // Create New User via Google
      user = await User.create({
        name,
        email,
        googleId: sub,
        avatar: picture,
        role: 'trial_user',
        planType: 'free_trial',
        password: crypto.randomBytes(20).toString('hex') // Dummy password
      });

      // Send Welcome Email
      try {
        await sendEmail({
          email: user.email,
          subject: 'Welcome to Marroncorp! 🚀',
          message: `<h1>Hi ${name},</h1><p>Welcome aboard via Google Login!</p>`
        });
      } catch (err) {}
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        planType: user.planType
      }
    });

  } catch (error) {
    console.error("Google Login Error:", error.message);
    res.status(400).json({ msg: 'Google Login Failed' });
  }
};

// ---------------------------------------------
// 5️⃣ FORGOT PASSWORD
// ---------------------------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    // Security: Don't reveal if user exists or not
    if (!user) {
      return res.status(200).json({ success: true, data: "Email sent" });
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Frontend URL
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    const message = `
      <h1>Password Reset Request</h1>
      <p>Click the link below to verify it's you:</p>
      <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Token',
        message,
      });
      res.status(200).json({ success: true, data: "Email sent" });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ msg: "Email could not be sent" });
    }
  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
};

// ---------------------------------------------
// 6️⃣ RESET PASSWORD
// ---------------------------------------------
exports.resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid Token' });
    }

    // Set new password (Middleware will hash it)
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // Invalidate old sessions
    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    
    await user.save();

    res.status(200).json({ success: true, data: "Password Updated Success" });

  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
};