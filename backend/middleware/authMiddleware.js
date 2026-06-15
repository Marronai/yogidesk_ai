const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getBearerToken, isJwtSegmentToken, rejectMalformedBearer } = require('../utils/tokenGuards');

if (!process.env.JWT_SECRET) {
  throw new Error("CRITICAL: JWT_SECRET environment variable is completely missing!");
}

const JWT_SECRET = process.env.JWT_SECRET;

// 🛡️ 1. Protect Middleware (Token Verification)
const protect = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ msg: 'Not authorized, no token' });
  }
  if (!isJwtSegmentToken(token)) {
    return rejectMalformedBearer(res);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ msg: 'Not authorized, token failed' });
    }

    if (user.role !== 'admin' && user.subscriptionStatus === 'suspended') {
      return res.status(403).json({ msg: 'Account access has been suspended.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    res.status(401).json({ msg: 'Not authorized, token failed' });
  }
};

// 👑 2. Admin Only Middleware
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) {
    return next();
  }
  res.status(403).json({ msg: 'Access denied. Admins/Managers only.' });
};

// ✅ Sahi tarika: Saare functions ek saath export karein
module.exports = { protect, adminOnly };
