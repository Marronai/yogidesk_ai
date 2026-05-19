require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const STARTER_LIFETIME_PATIENT_LIMIT = 500;

const normalizePhone = (phone) => String(phone || '').trim().replace(/\s+/g, '').replace(/[^\d]/g, '');
const normalizePlan = (plan) => String(plan || 'starter').toLowerCase().split(' ')[0];

const getRequestUserId = (req) => (
  req.user?.id ||
  req.body?.userId ||
  req.body?.user_id ||
  req.query?.userId ||
  req.query?.user_id ||
  null
);

const getWalletUsage = async (userId) => {
  const { data } = await supabase
    .from('wallets')
    .select('current_plan, plan_tier, lifetime_contacts_count')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    current_plan: data?.current_plan || data?.plan_tier || 'starter',
    lifetime_patients_count: Number(data?.lifetime_contacts_count || 0)
  };
};

const getProfileUsage = async (userId) => {
  const byId = await supabase
    .from('doctor_profiles')
    .select('id,user_id,current_plan,plan_tier,lifetime_patients_count')
    .eq('id', userId)
    .maybeSingle();

  if (byId.data) return byId.data;

  const byUserId = await supabase
    .from('doctor_profiles')
    .select('id,user_id,current_plan,plan_tier,lifetime_patients_count')
    .eq('user_id', userId)
    .maybeSingle();

  return byUserId.data || null;
};

const getUsageState = async (userId) => {
  try {
    const profile = await getProfileUsage(userId);
    if (profile) {
      return {
        profileId: profile.id,
        current_plan: profile.current_plan || profile.plan_tier || 'starter',
        lifetime_patients_count: Number(profile.lifetime_patients_count || 0),
        hasProfileCounter: true
      };
    }
  } catch (error) {
    console.warn('Profile lifetime counter unavailable, using wallet fallback:', error.message);
  }

  return {
    ...(await getWalletUsage(userId)),
    profileId: null,
    hasProfileCounter: false
  };
};

const mirrorUsageCount = async (userId, nextCount, profileId = null) => {
  if (profileId) {
    const { error } = await supabase
      .from('doctor_profiles')
      .update({ lifetime_patients_count: nextCount })
      .eq('id', profileId);

    if (error) console.warn('Profile lifetime counter update failed:', error.message);
  } else {
    const { error } = await supabase
      .from('doctor_profiles')
      .update({ lifetime_patients_count: nextCount })
      .eq('id', userId);

    if (error) console.warn('Profile lifetime counter update failed:', error.message);
  }

  const { error: walletError } = await supabase
    .from('wallets')
    .update({ lifetime_contacts_count: nextCount })
    .eq('user_id', userId);

  if (walletError) console.warn('Wallet lifetime counter mirror failed:', walletError.message);
};

const enforceStarterLimit = (usage, incoming = 1) => {
  const plan = normalizePlan(usage.current_plan);
  const currentCount = Number(usage.lifetime_patients_count || 0);
  if (plan === 'starter' && currentCount + incoming > STARTER_LIFETIME_PATIENT_LIMIT) {
    const error = new Error('Starter plan lifetime patient limit reached');
    error.statusCode = 403;
    throw error;
  }
};

exports.getUserUsage = async (req, res) => {
  try {
    if (!supabase?.from) throw new Error('Database connection unavailable.');
    const userId = getRequestUserId(req);
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const usage = await getUsageState(userId);
    return res.json({
      success: true,
      current_plan: usage.current_plan,
      lifetime_patients_count: Number(usage.lifetime_patients_count || 0),
      limit: normalizePlan(usage.current_plan) === 'starter' ? STARTER_LIFETIME_PATIENT_LIMIT : null
    });
  } catch (error) {
    console.error('Usage fetch error:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Unable to fetch usage.' });
  }
};

exports.addPatient = async (req, res) => {
  try {
    if (!supabase?.from) throw new Error('Database connection unavailable.');
    const userId = getRequestUserId(req);
    const name = String(req.body?.name || '').trim();
    const phone = normalizePhone(req.body?.phone);
    const appointmentTime = req.body?.appointment_time || null;

    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });

    const usage = await getUsageState(userId);
    enforceStarterLimit(usage, 1);

    const { data: existing } = await supabase
      .from('patients_ledger')
      .select('id')
      .eq('user_id', userId)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) return res.status(409).json({ success: false, message: 'Duplicate phone skipped.' });

    const { data, error } = await supabase
      .from('patients_ledger')
      .insert([{ user_id: userId, name, phone, appointment_time: appointmentTime }])
      .select('*')
      .single();

    if (error) throw error;

    const nextCount = Number(usage.lifetime_patients_count || 0) + 1;
    await mirrorUsageCount(userId, nextCount, usage.profileId);

    return res.status(201).json({ success: true, data, lifetime_patients_count: nextCount });
  } catch (error) {
    console.error('Add patient error:', error.message);
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Patient sync failed.' });
  }
};

exports.addPatients = async (req, res) => {
  try {
    if (!supabase?.from) throw new Error('Database connection unavailable.');
    const userId = getRequestUserId(req);
    const rows = Array.isArray(req.body?.patients) ? req.body.patients : [];

    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const normalizedRows = rows
      .map((row) => ({
        user_id: userId,
        name: String(row.name || '').trim(),
        phone: normalizePhone(row.phone),
        appointment_time: row.appointment_time || null
      }))
      .filter((row) => row.name && /^\d{10}$/.test(row.phone));

    const uniqueRows = [];
    const seen = new Set();
    for (const row of normalizedRows) {
      if (seen.has(row.phone)) continue;
      seen.add(row.phone);
      uniqueRows.push(row);
    }

    if (!uniqueRows.length) return res.status(400).json({ success: false, message: 'No valid rows found.' });

    const usage = await getUsageState(userId);
    enforceStarterLimit(usage, uniqueRows.length);

    const { data, error } = await supabase
      .from('patients_ledger')
      .insert(uniqueRows)
      .select('*');

    if (error) throw error;

    const insertedRows = Array.isArray(data) ? data : [];
    const nextCount = Number(usage.lifetime_patients_count || 0) + insertedRows.length;
    await mirrorUsageCount(userId, nextCount, usage.profileId);

    return res.status(201).json({ success: true, data: insertedRows, lifetime_patients_count: nextCount });
  } catch (error) {
    console.error('Bulk add patients error:', error.message);
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Patient import failed.' });
  }
};
