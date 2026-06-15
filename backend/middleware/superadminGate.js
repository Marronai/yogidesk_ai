const { supabaseAdmin } = require('../config/supabase');
const { isSuperAdminUser } = require('../utils/superadminSecurity');
const { getBearerToken, isJwtSegmentToken } = require('../utils/tokenGuards');

const hiddenNotFound = (res) => res.status(404).json({ success: false, message: 'Not found.' });
const SUPERADMIN_PERMISSION_KEYS = [
  'can_view_owner_overview',
  'can_view_universal_matrix',
  'can_override_plan_wallet',
  'can_manage_meta_compliance',
  'can_use_kill_switch',
];

const fullPermissions = () => SUPERADMIN_PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = true;
  return acc;
}, {});

const rowPermissions = (row = {}) => SUPERADMIN_PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = Boolean(row[key]);
  return acc;
}, {});

const isMissing = (error) => {
  const text = String(`${error?.message || ''} ${error?.details || ''}`).toLowerCase();
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code) || text.includes('does not exist') || text.includes('schema cache');
};

const loadInternalStaff = async (user = {}) => {
  if (!supabaseAdmin?.from || (!user?.id && !user?.email)) return null;
  const columns = `id,name,email,auth_user_id,is_active,status,${SUPERADMIN_PERMISSION_KEYS.join(',')}`;
  const filters = [];
  if (user.id) filters.push((query) => query.eq('auth_user_id', user.id));
  if (user.email) filters.push((query) => query.eq('email', String(user.email).toLowerCase()));

  for (const applyFilter of filters) {
    const { data, error } = await applyFilter(
      supabaseAdmin.from('superadmin_staff').select(columns).eq('is_active', true)
    ).limit(1).maybeSingle();
    if (!error && data?.id) return data;
    if (error && !isMissing(error)) throw error;
  }
  return null;
};

const requireSuperadminMetadata = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token || !isJwtSegmentToken(token) || !supabaseAdmin?.auth?.getUser) return hiddenNotFound(res);

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return hiddenNotFound(res);

    if (isSuperAdminUser(data.user)) {
      req.superadmin = data.user;
      req.superadminRole = 'owner';
      req.superadminPermissions = fullPermissions();
      return next();
    }

    const staff = await loadInternalStaff(data.user);
    if (!staff?.id) return hiddenNotFound(res);

    req.superadmin = data.user;
    req.superadminRole = 'staff';
    req.superadminStaff = staff;
    req.superadminPermissions = rowPermissions(staff);
    return next();
  } catch (error) {
    console.error('Hidden superadmin gate failed:', error.message || error);
    return hiddenNotFound(res);
  }
};

module.exports = {
  SUPERADMIN_PERMISSION_KEYS,
  fullPermissions,
  hiddenNotFound,
  loadInternalStaff,
  requireSuperadminMetadata,
  rowPermissions,
};
