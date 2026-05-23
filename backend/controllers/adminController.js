require('dotenv').config();
const { supabase: sharedSupabase, supabaseAdmin } = require('../config/supabase');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL CONFIGURATION ERROR: Supabase environment credentials evaluating to undefined.");
}

const supabase = supabaseAdmin || sharedSupabase;

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
    if (!supabase?.from) {
      return res.status(500).json({ success: false, message: "Supabase client is not initialized." });
    }

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

/**
 * Clean Wallet Balance Sync Endpoint
 */
exports.getWalletBalance = async (req, res) => {
  try {
    if (!supabase?.from) {
      return res.status(500).json({ success: false, message: "Supabase client is not initialized." });
    }

    const userId = req.user?.id || req.query?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized access" });

    const { data: walletRow, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    const balanceValue = parseFloat(walletRow?.balance || 0).toFixed(2);
    return res.status(200).json({ success: true, balance: Number(balanceValue) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Wallet balance sync failed", error: error.message });
  }
};
