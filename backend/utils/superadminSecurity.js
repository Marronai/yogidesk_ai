const cleanText = (value, maxLength = 160) => String(value || '')
  .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  .replace(/[<>]/g, '')
  .replace(/(--|\/\*|\*\/|;|\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|MERGE|SELECT|TRUNCATE|UNION|UPDATE)\b)/gi, '')
  .split('')
  .filter((char) => {
    const code = char.charCodeAt(0);
    return code >= 32 || code === 9 || code === 10 || code === 13;
  })
  .join('')
  .trim()
  .slice(0, maxLength);

const cleanEmail = (value) => cleanText(value, 254).toLowerCase().replace(/[^\w.+@-]/g, '');

const cleanUuid = (value) => {
  const clean = cleanText(value, 80);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean)
    ? clean
    : '';
};

const cleanMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Number(amount.toFixed(2));
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');

const isSuperAdminRole = (value) => ['superadmin', 'super_admin'].includes(normalizeRole(value));

const isSuperAdminUser = (user = {}) => [
  user?.app_metadata?.role,
  user?.app_metadata?.user_role,
  user?.app_metadata?.account_role,
  user?.user_metadata?.role,
  user?.user_metadata?.user_role,
  user?.user_metadata?.account_role,
  user?.role,
  user?.user_role,
].some(isSuperAdminRole);

const createLocalRateLimiter = ({ windowMs = 15 * 60 * 1000, max = 8 } = {}) => {
  const buckets = new Map();

  return (req, res, next) => {
    const key = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${cleanEmail(req.body?.email || '')}`;
    const now = Date.now();
    const current = buckets.get(key) || { count: 0, resetAt: now + windowMs };
    if (current.resetAt <= now) {
      current.count = 0;
      current.resetAt = now + windowMs;
    }
    current.count += 1;
    buckets.set(key, current);

    if (current.count > max) {
      return res.status(429).json({ success: false, message: 'Not found.' });
    }
    return next();
  };
};

module.exports = {
  cleanEmail,
  cleanMoney,
  cleanText,
  cleanUuid,
  createLocalRateLimiter,
  isSuperAdminRole,
  isSuperAdminUser,
  normalizeRole,
};
