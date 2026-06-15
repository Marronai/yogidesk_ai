const { supabaseAdmin } = require('../config/supabase');
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

  const { data: profile, error } = await supabaseAdmin
    .from('doctor_profiles')
    .select('user_role, role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Super Admin profile lookup failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to verify super admin access.' });
  }

  const roleValue = String(profile?.user_role || profile?.role || user?.user_metadata?.role || user?.role || '').toUpperCase();
  if (roleValue !== 'SUPER_ADMIN') {
    return res.status(403).json({ success: false, message: 'Restricted Access: Super Admin authority required.' });
  }

  req.superAdminUser = user;
  next();
};

module.exports = { requireSuperAdmin };
