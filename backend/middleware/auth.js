// FILE: backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is completely missing!");
}

const JWT_SECRET = process.env.JWT_SECRET;

// 🛡️ 1. Protect Middleware (Ab Session Check ke bina)
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Token Verify karo
      const decoded = jwt.verify(token, JWT_SECRET);

      // User dhundo
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ msg: "User not found" });
      }

      // 🔥 A. ACCOUNT SUSPENSION CHECK
      if (user.role !== 'admin' && user.subscriptionStatus === 'suspended') {
        return res.status(403).json({ msg: "Account access has been suspended." });
      }

      // ❌❌ DELETED: SESSION CHECK LOGIC REMOVED ❌❌
      // Maine yahan se wo code hata diya jo "Session Mismatch" par logout kar raha tha.
      // Ab user chahe purane token se aaye ya naye, kabhi logout nahi hoga.

      // 🕒 C. SHIFT TIMING CHECK (Sirf Employees ke liye)
      if (user.role === 'employee') {
        const currentTime = new Date();
        const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();

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

// 👑 2. Admin Only Middleware
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({ msg: "Access denied. Admins or Managers only." });
  }
};

module.exports = { protect, adminOnly };
