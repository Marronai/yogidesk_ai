const User = require('../models/User');
const sendEmail = require('../utils/sendEmailResend'); // Tumhara Resend wala file
const { welcomeEmailTemplate, otpEmailTemplate } = require('../utils/emailTemplates'); // Templates wala file
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
// 1️⃣ REGISTER STEP 1: Create User & Send OTP (No Token Yet)
// ---------------------------------------------
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, businessName, businessType } = req.body;

    // 1. Check if user exists
    let user = await User.findOne({ email });
    
    // Agar user hai aur verified hai -> Error
    if (user && user.isVerified) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    // 2. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 Minutes

    // 3. Create or Update User (Verified: false rakhenge)
    if (!user) {
      user = await User.create({
        name,
        email,
        password, // Pre-save hook will hash it
        phone,
        businessName,
        businessType,
        role: 'trial_user',
        planType: 'free_trial',
        otp: otp,
        otpExpires: otpExpires,
        isVerified: false // 🔒 Abhi verify nahi hua
      });
    } else {
      // Agar user tha par verify nahi kiya tha, toh naya OTP update karo
      user.name = name;
      user.password = password;
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    }

    // 4. 📧 SEND OTP EMAIL (Template Use Kiya)
    try {
      const emailHtml = otpEmailTemplate(otp); // Template se HTML lo
      
      await sendEmail({
        email: user.email,
        subject: 'Verify your Account - YogiDesk AI',
        message: emailHtml,
      });
    } catch (emailError) {
      console.error("Signup OTP Failed:", emailError.message);
      return res.status(500).json({ msg: "Email sending failed. Please try again." });
    }

    res.status(200).json({
      success: true,
      msg: 'OTP sent to your email. Please verify to complete registration.',
      email: user.email,
      step: 'verify_signup' // Frontend ko signal
    });

  } catch (error) {
    console.error("Signup Error:", error.message);
    res.status(500).json({ msg: 'Server Error' });
  }
};

// ---------------------------------------------
// 2️⃣ REGISTER STEP 2: Verify OTP & Send Welcome Email
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
    await user.save();

    // 📧 SEND WELCOME EMAIL (Ab user verify ho gaya)
    try {
      const dashboardLink = "https://yogidesk-ai.vercel.app/login"; // Apna Frontend Link daalo
      const welcomeHtml = welcomeEmailTemplate(user.name, dashboardLink);

      await sendEmail({
        email: user.email,
        subject: 'Welcome to YogiDesk AI! 🚀 Your Account is Ready',
        message: welcomeHtml,
      });
    } catch (err) {
      console.error("Welcome Email Failed:", err);
    }

    // Generate Token
    const token = generateToken(user._id);

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
// 3️⃣ LOGIN STEP 1: Verify Password & Send OTP
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

    // 4. Generate 6 Digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 📧 SEND OTP EMAIL (Template Use Kiya)
    try {
      const emailHtml = otpEmailTemplate(otp); // Wahi same OTP template login ke liye bhi
      
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
      msg: 'OTP Sent to your email', 
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
    user.currentSessionId = crypto.randomBytes(16).toString('hex');
    await user.save();

    const token = generateToken(user._id);

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
// 5️⃣ GOOGLE LOGIN
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
    let isNewUser = false;

    if (user) {
      if (!user.googleId) {
        user.googleId = sub;
        user.avatar = picture;
        await user.save();
      }
    } else {
      isNewUser = true;
      user = await User.create({
        name,
        email,
        googleId: sub,
        avatar: picture,
        role: 'trial_user',
        planType: 'free_trial',
        isVerified: true, // Google wale verified hote hain
        password: crypto.randomBytes(20).toString('hex')
      });
    }

    // 📧 Agar naya user hai toh Welcome Email Bhejo
    if (isNewUser) {
      try {
        const dashboardLink = "https://yogidesk-ai.vercel.app/dashboard";
        const welcomeHtml = welcomeEmailTemplate(name, dashboardLink);
        
        await sendEmail({
          email: user.email,
          subject: 'Welcome to YogiDesk AI! 🚀',
          message: welcomeHtml
        });
      } catch (err) {}
    }

    const token = generateToken(user._id);

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
// 6️⃣ FORGOT PASSWORD (OTP Based)
// ---------------------------------------------
// Isko bhi template ke sath update kar sakte ho, 
// filhal purana wala logic rakha hai par sendEmailResend use karega.
exports.forgotPassword = async (req, res) => {
  // ... (Same Logic, bas sendEmail updated file use karega) ...
  // Shortened for brevity, use purana logic here
};

exports.resetPassword = async (req, res) => {
   // ... (Same Logic) ...
};