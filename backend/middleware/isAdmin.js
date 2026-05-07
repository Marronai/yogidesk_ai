const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({ msg: 'Access denied. Admin role required.' });
};

module.exports = isAdmin;
