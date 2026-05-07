const jwt = require('jsonwebtoken');
const User = require('../models/User');

const adminMiddleware = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ msg: 'Admin authorization token required.' });
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
