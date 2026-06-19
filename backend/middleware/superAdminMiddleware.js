const { supabaseAdmin } = require('../config/supabase');
const { isSuperAdminUser } = require('../utils/superadminSecurity');
const { getBearerToken, isJwtSegmentToken } = require('../utils/tokenGuards');

const getSupabaseUser = async (req) => {
  const token = getBearerToken(req);
  if (!token || !isJwtSegmentToken(token)) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
};

const requireSuperAdmin = async (req, res, next) => {
  const user = await getSupabaseUser(req);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized access' });
  }

  if (!isSuperAdminUser(user)) {
    return res.status(403).json({ success: false, message: 'Restricted Access: Super Admin authority required.' });
  }

  req.superAdminUser = user;
  next();
};

module.exports = { requireSuperAdmin };
