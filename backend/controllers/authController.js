const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Token Nikalo
      token = req.headers.authorization.split(' ')[1];
      
      // 2. Decode Karo
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. User Dhundo
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ msg: "User not found" });
      }

      // ============================================================
      // 🐛 DEBUGGING LOGS (Render Logs mein check karna agar fail ho)
      // ============================================================
      // console.log(`🔍 Checking User: ${user.email}`);
      // console.log(`🔹 DB SessionID: ${user.currentSessionId}`);
      // console.log(`🔸 Token SessionID: ${decoded.sessionId}`);

      // 🛑 SMART SESSION CHECK
      // Sirf tab logout karo jab:
      // 1. User ke paas DB mein SessionID ho.
      // 2. Token ke paas bhi SessionID ho.
      // 3. Aur dono MATCH NA KAREIN.
      
      if (user.currentSessionId && decoded.sessionId) {
          if (user.currentSessionId !== decoded.sessionId) {
              console.log("🚫 BLOCKING: Session Mismatch detected!");
              return res.status(401).json({ 
                  msg: "Session expired. You logged in on another device.",
                  logout: true 
              });
          }
      }
      
      // Agar Token mein sessionId nahi hai (Purana token), toh hum 'PASS' de denge.
      // Isse tumhara "Immediate Logout" band ho jayega.

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

module.exports = { protect };