const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🛡️ 1. Protect Middleware (Login + Session + Shift + SUBSCRIPTION CHECK)
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "mera_secret_key");

      // User dhundo
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ msg: "User not found" });
      }

      // 🛑 A. SUBSCRIPTION/TRIAL EXPIRY CHECK (The Kill Switch)
      const now = new Date();
      if (user.planExpiryDate && now > user.planExpiryDate) {
        return res.status(403).json({ 
          msg: "Your trial/plan has expired. Please upgrade to continue using Yogidesk.",
          isExpired: true // Frontend redirect ke liye easy flag
        });
      }

      // 🔒 B. SINGLE SESSION CHECK
      if (user.currentSessionId && user.currentSessionId !== decoded.sessionId) {
        return res.status(401).json({ msg: "Session expired. You logged in on another device." });
      }

      // 🕒 C. SHIFT TIMING CHECK (Modified to match our new User model)
      if (user.role === 'employee') {
        const currentTime = new Date();
        const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

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

      req.user = user;
      next();
      
    } catch (error) {
      console.error("Auth Error:", error.message);
      res.status(401).json({ msg: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ msg: "Not authorized, no token" });
  }
};

// 👑 2. Admin/Manager Only Middleware
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({ msg: "Access denied. Admins/Managers only." });
  }
};

module.exports = { protect, adminOnly };