const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🛡️ 1. Protect Middleware
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      
      // Token Verify karo
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "mera_secret_key");

      // User dhundo
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ msg: "User not found" });
      }

      // 🛑 A. SUBSCRIPTION CHECK
      const now = new Date();
      if (user.planExpiryDate && now > user.planExpiryDate) {
        return res.status(403).json({ 
          msg: "Your trial/plan has expired. Please upgrade to continue.",
          isExpired: true 
        });
      }

      // 🔒 B. SINGLE SESSION CHECK (FIXED 🛠️)
      // Problem: Agar Token me sessionId nahi aaya, toh turant logout ho raha tha.
      // Fix: Hum tabhi check karenge jab Token me sessionId maujood ho.
      
      if (user.currentSessionId && decoded.sessionId) {
          if (user.currentSessionId !== decoded.sessionId) {
              console.log(`🚫 Session Mismatch! DB: ${user.currentSessionId} | Token: ${decoded.sessionId}`);
              return res.status(401).json({ msg: "Session expired. You logged in on another device." });
          }
      } 
      // Agar Token me sessionId nahi hai, toh hum 'Pass' de denge (Temporary Fix for Old Tokens)

      // 🕒 C. SHIFT TIMING CHECK (Employees Only)
      if (user.role === 'employee') {
        const currentTime = new Date();
        const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

        // Shift format "09:00" ensure karna
        if(user.shiftStart && user.shiftEnd) {
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

// 👑 2. Admin/Manager Only
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({ msg: "Access denied. Admins/Managers only." });
  }
};

module.exports = { protect, adminOnly };