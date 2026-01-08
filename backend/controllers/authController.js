const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { welcomeEmailTemplate, otpEmailTemplate } = require('../utils/emailTemplates');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios'); // ✅ Google User Data fetch karne ke liye

// ---------------------------------------------
// 🛠️ HELPER: Token Generator (FIXED ✅)
// ---------------------------------------------
// Ab ye Session ID bhi lega, taaki token aur DB match ho sakein
const generateToken = (id, sessionId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("FATAL ERROR: JWT_SECRET is not defined.");
  }
  // 👇 Yahan sessionId add kiya hai, yehi missing tha pehle
  return jwt.sign({ id, sessionId }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// ---------------------------------------------
// 1️⃣ REGISTER STEP 1: Details Lo & OTP Bhejo
// ---------------------------------------------
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, businessName, businessType } = req.body;

    // 1. Check if user exists
    let user = await User.findOne({ email });

    // Agar user pehle se verified hai, toh error do
    if (user && user.isVerified) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // 2. Generate 6 Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 Minutes

    // 3. Create or Update User (Verified: false)
    if (!user) {
      user = await User.create({
        name,
        email,
        password, // Model ka pre-save hook hash karega
        phone,
        businessName,
        businessType,
        role: 'trial_user',
        planType: 'free_trial',
        otp: otp,
        otpExpires: otpExpires,
        isVerified: false
      });
    } else {
      // Agar user tha par verify nahi tha, toh details update karo
      user.name = name;
      user.password = password;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    }

    // 4. 📧 SEND OTP EMAIL
    try {
      const emailHtml = otpEmailTemplate(otp); // Template se HTML lo
      
      await sendEmail({
        email: user.email,
        subject: 'Verify your Account - YogiDesk AI',
        message: emailHtml,
      });
    } catch (emailError) {
      console.error("Signup Email Error:", emailError.message);
      return res.status(500).json({ msg: "Email sending failed. Please try again." });
    }

    res.status(200).json({
      success: true,
      msg: 'OTP sent to your email.',
      email: user.email,
      step: 'verify_signup' // Frontend ko signal
    });

  } catch (error) {
    console.error("Signup Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 2️⃣ REGISTER STEP 2: Verify OTP, Set Session & Welcome
// ---------------------------------------------
exports.verifySignupOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // User dhoondo (+otp hidden field)
    const user = await User.findOne({ email }).select('+otp +otpExpires');

    if (!user) return res.status(400).json({ msg: 'User not found' });

    // Validate OTP
    if (user.otp !== otp) return res.status(400).json({ msg: 'Invalid OTP' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ msg: 'OTP Expired' });

    // ✅ Success: Verify User & Clear OTP
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    
    // 🔒 FIX: Session ID set karo taaki logout na ho
    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    
    await user.save();

    // 📧 SEND WELCOME EMAIL
    try {
      const dashboardLink = "https://yogidesk-ai.vercel.app/login";
      const welcomeHtml = welcomeEmailTemplate(user.name, dashboardLink);

      await sendEmail({
        email: user.email,
        subject: 'Welcome to YogiDesk AI! 🚀 Your Account is Ready',
        message: welcomeHtml,
      });
    } catch (err) {
      console.error("Welcome Email Failed:", err);
    }

    // Generate Token (Session ID ke sath)
    const token = generateToken(user._id, user.currentSessionId);

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error("Verify Signup Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 3️⃣ LOGIN STEP 1: Verify Pass & Send OTP
// ---------------------------------------------
exports.loginStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

    // Google check
    if (user.googleId) return res.status(400).json({ msg: 'Please use Google Login' });

    // Password Check
    const isMatch = await user.matchPassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 📧 SEND OTP EMAIL
    try {
      const emailHtml = otpEmailTemplate(otp);
      
      await sendEmail({
        email: user.email,
        subject: 'Login OTP - YogiDesk AI 🔒',
        message: emailHtml,
      });
    } catch (err) {
      return res.status(500).json({ msg: "Email could not be sent" });
    }

    res.status(200).json({ 
      success: true, 
      msg: 'OTP Sent', 
      email: user.email,
      step: 'verify_login' 
    });

  } catch (error) {
    console.error("Login Step 1 Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 4️⃣ LOGIN STEP 2: Verify Login OTP
// ---------------------------------------------
exports.verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select('+otp +otpExpires');
    if (!user) return res.status(400).json({ msg: 'User not found' });

    if (user.otp !== otp) return res.status(400).json({ msg: 'Invalid OTP' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ msg: 'OTP Expired' });

    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    
    // 🔒 FIX: Session ID Update
    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    // Generate Token (Session ID ke sath)
    const token = generateToken(user._id, user.currentSessionId);

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error("Verify Login Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 5️⃣ GOOGLE LOGIN (AXIOS FIX ✅)
// ---------------------------------------------
exports.googleLogin = async (req, res) => {
  try {
    const { tokenId } = req.body; // Frontend se 'Access Token' aayega

    // ✅ STEP 1: Google API se user data mango (axios use kar rahe hain)
    const googleRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenId}` }
    });

    const { name, email, picture, sub } = googleRes.data;

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // Agar user hai par Google link nahi hai, toh link karo
      if (!user.googleId) {
        user.googleId = sub;
        user.avatar = picture;
      }
    } else {
      // Naya User Banao
      isNewUser = true;
      user = await User.create({
        name,
        email,
        googleId: sub,
        avatar: picture,
        role: 'trial_user',
        planType: 'free_trial',
        isVerified: true, // Google trusted source hai
        password: crypto.randomBytes(20).toString('hex') // Dummy password
      });
      
      // 📧 Welcome Email Bhejo
      try {
        const dashboardLink = "https://yogidesk-ai.vercel.app/dashboard";
        const welcomeHtml = welcomeEmailTemplate(name, dashboardLink);
        
        await sendEmail({
          email: user.email,
          subject: 'Welcome to YogiDesk AI! 🚀',
          message: welcomeHtml
        });
      } catch (err) {
        console.error("Welcome email failed", err);
      }
    }

    // 🔒 FIX: Session ID zaroor set karo
    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    // Generate Token (Session ID ke sath)
    const token = generateToken(user._id, user.currentSessionId);

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });

  } catch (error) {
    console.error("Google Login Error:", error.message);
    res.status(400).json({ msg: 'Google Login Failed' });
  }
};

// ---------------------------------------------
// 6️⃣ FORGOT PASSWORD (Link Bhejo)
// ---------------------------------------------
exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(200).json({ success: true, data: "Email sent" }); // Fake success for security

    // Token generate karo (Model method)
    const resetToken = user.getResetPasswordToken(); 
    await user.save({ validateBeforeSave: false });

    // Link banao
    const resetUrl = `https://yogidesk-ai.vercel.app/reset-password/${resetToken}`;

    const message = `
      <h1>Password Reset Request</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}" style="background:#FF6B00; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Reset Password</a>
      <p>If you didn't request this, ignore this email.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset - YogiDesk AI',
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
// 7️⃣ RESET PASSWORD (New Pass Set)
// ---------------------------------------------
exports.resetPassword = async (req, res) => {
  try {
    // URL token ko Hash karo taaki DB se match ho sake
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid or Expired Token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // Purane sessions invalidate karo
    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    
    await user.save();

    res.status(200).json({ success: true, data: "Password Updated Success" });

  } catch (error) {
    res.status(500).json({ msg: "Server Error" });
  }
};