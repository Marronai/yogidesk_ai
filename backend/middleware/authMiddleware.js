const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 🛡️ 1. Protect Middleware (Ab Session Check ke bina - Full Safe Mode)
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

      // 🔥 A. SUBSCRIPTION/TRIAL CHECK
      // (Agar tum sure ho ki tumhara trial expired nahi hai, tabhi isse on rakhna)
      // Debugging ke liye main ise abhi COMMENT kar raha hu taaki koi roka-toki na ho.
      
      /* const now = new Date();
      if (user.planExpiryDate && now > user.planExpiryDate) {
        return res.status(403).json({ 
          msg: "Your trial/plan has expired. Please upgrade to continue.",
          isExpired: true 
        });
      } 
      */

      // ❌❌ SESSION CHECK REMOVED ❌❌
      // Maine yahan se wo "Smart Check" hata diya hai.
      // Ab backend kabhi bhi session mismatch ki wajah se logout nahi karega.

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
    res.status(401).json({ msg: "Not authorized, no token" });
  }
};

// 👑 2. Admin Only Middleware
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({ msg: "Access denied. Admins/Managers only." });
  }
};

module.exports = { protect, adminOnly };