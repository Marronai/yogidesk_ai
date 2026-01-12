// FILE: backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🛡️ 1. Protect Middleware (Login + Session + Trial Expiry Check)
const protect = async (req, res, next) => {
  let token;

  // Check if token exists in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "mera_secret_key");

      // Get user from database (excluding password)
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ msg: "User not found" });
      }

      // 🔥 A. SUBSCRIPTION/TRIAL CHECK (The System Lock)
      const now = new Date();
      if (user.planExpiryDate && now > user.planExpiryDate) {
        return res.status(403).json({ 
          msg: "Your 5-day trial or plan has expired. Please upgrade to continue.",
          isExpired: true 
        });
      }

      // 🔒 B. SMART SESSION CHECK (The Auto-Logout Fix ✅)
      // Logic: Sirf tab logout karo jab Token aur DB dono ke paas ID ho, aur wo ALAG ho.
      // Agar Token purana hai (sessionId missing), toh user ko pareshan mat karo.
      
      if (user.currentSessionId && decoded.sessionId) {
          if (user.currentSessionId !== decoded.sessionId) {
            console.log(`🚫 Session Mismatch! DB: ${user.currentSessionId} | Token: ${decoded.sessionId}`);
            return res.status(401).json({ 
                msg: "Session expired. Logged in from another device.",
                logout: true // ✅ Frontend signal to clear storage
            });
          }
      }

      // 🕒 C. SHIFT TIMING CHECK (Sirf Employees ke liye)
      if (user.role === 'employee') {
        const currentTime = new Date();
        const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

        // Shift check tabhi karo jab start/end defined ho
        if (user.shiftStart && user.shiftEnd) {
            const [startH, startM] = user.shiftStart.split(':').map(Number);
            const [endH, endM] = user.shiftEnd.split(':').map(Number);

            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;

            if (currentMins < startMins || currentMins > endMins) {
            return res.status(403).json({ 
                msg: `Access Denied: Your shift is from ${user.shiftStart} to ${user.shiftEnd}` 
            });
            }
        }
      }

      // Sab sahi hai, toh request object mein user add karo
      req.user = user;
      next();
      
    } catch (error) {
      console.error("Auth Middleware Error:", error.message);
      res.status(401).json({ msg: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ msg: "No token, authorization denied" });
  }
};

// 👑 2. Admin Only Middleware (Sirf Boss/Manager ke liye)
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({ msg: "Access denied. Admins or Managers only." });
  }
};

module.exports = { protect, adminOnly };