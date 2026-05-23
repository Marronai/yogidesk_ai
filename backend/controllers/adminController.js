require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const PLAN_CONTACT_LIMITS = { starter: 500, growth: 2000, hospital: 10000 };

/**
 * Middleware-like validation helper
 */
exports.requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: "Restricted Access: Super Admin authority required." });
  }
  next();
};

/**
 * Analytical API for Owner Metrics
 * Aggregates doctor usage data silently
 */
exports.getMetricsSummary = async (req, res) => {
  try {
    // 1. Fetch all doctor profiles
    const { data: doctors, error: dError } = await supabase
      .from('doctor_profiles')
      .select('id, name, email, plan_type, last_login_at, lifetime_patients_count');

    if (dError) throw dError;

    // 2. Aggregate metrics and check tier violations
    const summary = await Promise.all(doctors.map(async (doc) => {
      const tier = String(doc.plan_type || 'starter').toLowerCase();
      const limit = PLAN_CONTACT_LIMITS[tier] || 500;
      
      // Direct count check from ledger for accuracy
      const { count } = await supabase
        .from('patients_ledger')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', doc.id);

      return {
        ...doc,
        actual_count: count || 0,
        limit_threshold: limit,
        is_breached: (count || 0) >= limit
      };
    }));

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: "Metrics aggregation failed", error: error.message });
  }
};