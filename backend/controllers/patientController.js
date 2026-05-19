require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const STARTER_LIFETIME_PATIENT_LIMIT = 500;

const normalizePhone = (phone) => String(phone || '').trim().replace(/\s+/g, '').replace(/[^\d]/g, '');
const normalizePlan = (plan) => String(plan || 'starter').toLowerCase().split(' ')[0];

const getRequestUserId = (req) => (
  req.user?.id || null
);

const getProfileUsage = async (req) => {
  const { data, error } = await supabase
    .from('doctor_profiles')
    .select('id,lifetime_patients_count')
    .eq('id', req.user.id)
    .maybeSingle();

  if (error) throw error;

  return data || null;
};

const getUsageState = async (req) => {
  try {
    const profile = await getProfileUsage(req);
    if (profile) {
      return {
        profileId: profile.id,
        current_plan: 'starter',
        lifetime_patients_count: Number(profile.lifetime_patients_count || 0),
        hasProfileCounter: true
      };
    }
  } catch (error) {
    throw new Error(error.message || 'Profile lifetime counter unavailable.');
  }

  throw new Error('Doctor profile not found.');
};

const persistUsageCount = async (req, increment = 1) => {
  const userId = req.user.id;
  const profile = await getProfileUsage(req);
  if (!profile) throw new Error('Doctor profile not found.');

  const currentCount = Number(profile.lifetime_patients_count || 0);
  const nextCount = currentCount + increment;

  const rpcResult = await supabase.rpc('increment_lifetime_patients_count', {
    profile_id: req.user.id,
    increment_by: increment
  });

  if (!rpcResult.error && Number.isFinite(Number(rpcResult.data))) {
    const incrementedCount = Number(rpcResult.data);
    const { error: walletError } = await supabase
      .from('wallets')
      .update({ lifetime_contacts_count: incrementedCount })
      .eq('user_id', userId);

    if (walletError) console.warn('Wallet lifetime counter mirror failed:', walletError.message);
    return incrementedCount;
  }

  const { error } = await supabase
    .from('doctor_profiles')
    .update({ lifetime_patients_count: currentCount + increment })
    .eq('id', req.user.id);

  if (error) throw error;

  const { error: walletError } = await supabase
    .from('wallets')
    .update({ lifetime_contacts_count: nextCount })
    .eq('user_id', userId);

  if (walletError) console.warn('Wallet lifetime counter mirror failed:', walletError.message);
  return currentCount + increment;
};

const enforceStarterLimit = (usage, incoming = 1) => {
  const plan = normalizePlan(usage.current_plan);
  const currentCount = Number(usage.lifetime_patients_count || 0);
  if (plan === 'starter' && (currentCount >= STARTER_LIFETIME_PATIENT_LIMIT || currentCount + incoming > STARTER_LIFETIME_PATIENT_LIMIT)) {
    const error = new Error('Starter plan lifetime patient limit reached.');
    error.statusCode = 403;
    throw error;
  }
};

exports.getUserUsage = async (req, res) => {
  try {
    if (!supabase?.from) throw new Error('Database connection unavailable.');
    const userId = getRequestUserId(req);
    if (!userId) return res.status(400).json({ success: false, message: 'userId is required.' });

    const usage = await getUsageState(req);
    return res.json({
      success: true,
      lifetime_patients_count: Number(usage.lifetime_patients_count || 0),
      limit: STARTER_LIFETIME_PATIENT_LIMIT
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

    const usage = await getUsageState(req);
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

    const nextCount = await persistUsageCount(req, 1);

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

    const usage = await getUsageState(req);
    enforceStarterLimit(usage, uniqueRows.length);

    const { data, error } = await supabase
      .from('patients_ledger')
      .insert(uniqueRows)
      .select('*');

    if (error) throw error;

    const insertedRows = Array.isArray(data) ? data : [];
    const nextCount = await persistUsageCount(req, insertedRows.length);

    return res.status(201).json({ success: true, data: insertedRows, lifetime_patients_count: nextCount });
  } catch (error) {
    console.error('Bulk add patients error:', error.message);
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Patient import failed.' });
  }
};
