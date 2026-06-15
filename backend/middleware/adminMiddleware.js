const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getBearerToken, isJwtSegmentToken, rejectMalformedBearer } = require('../utils/tokenGuards');

const adminMiddleware = async (req, res, next) => {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ msg: 'Admin authorization token required.' });
  }
  if (!isJwtSegmentToken(token)) {
    return rejectMalformedBearer(res);
  }

  try {
    const secret = process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988';
    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id).select('-password');

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin role required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error.message);
    res.status(401).json({ msg: 'Invalid or expired admin token.' });
  }
};

module.exports = adminMiddleware;
