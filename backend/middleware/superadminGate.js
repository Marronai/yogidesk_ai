const { supabaseAdmin } = require('../config/supabase');
const { isSuperAdminUser } = require('../utils/superadminSecurity');

const hiddenNotFound = (res) => res.status(404).json({ success: false, message: 'Not found.' });

const getBearerToken = (req) => {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const requireSuperadminMetadata = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token || !supabaseAdmin?.auth?.getUser) return hiddenNotFound(res);

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !isSuperAdminUser(data?.user)) return hiddenNotFound(res);

    req.superadmin = data.user;
    return next();
  } catch (error) {
    console.error('Hidden superadmin gate failed:', error.message || error);
    return hiddenNotFound(res);
  }
};

module.exports = { hiddenNotFound, requireSuperadminMetadata };
