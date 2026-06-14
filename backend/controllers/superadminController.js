const { supabaseAdmin } = require('../config/supabase');
const {
  cleanEmail,
  cleanMoney,
  cleanText,
  cleanUuid,
  isSuperAdminUser,
  normalizeRole,
} = require('../utils/superadminSecurity');

const db = supabaseAdmin;
const nowIso = () => new Date().toISOString();
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const isMissing = (error) => {
  const text = String(`${error?.message || ''} ${error?.details || ''}`).toLowerCase();
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code) || text.includes('schema cache') || text.includes('does not exist');
};
const daysUntil = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.ceil(ms / 86400000) : null;
};

const safeSelect = async (table, columns, build = (query) => query) => {
  try {
    if (!db?.from) return [];
    const result = await build(db.from(table).select(columns));
    if (result.error) {
      if (isMissing(result.error)) return [];
      throw result.error;
    }
    return result.data || [];
  } catch (error) {
    if (!isMissing(error)) console.warn(`Superadmin ${table} query skipped:`, error.message || error);
    return [];
  }
};

const safeCount = async (table, build = (query) => query) => {
  try {
    if (!db?.from) return 0;
    const result = await build(db.from(table).select('id', { count: 'exact', head: true }));
    if (result.error) {
      if (isMissing(result.error)) return 0;
      throw result.error;
    }
    return number(result.count);
  } catch (error) {
    if (!isMissing(error)) console.warn(`Superadmin ${table} count skipped:`, error.message || error);
    return 0;
  }
};

const groupCount = (rows, key, fallback = 'unknown') => rows.reduce((acc, row) => {
  const label = String(row?.[key] || fallback).toLowerCase();
  acc[label] = (acc[label] || 0) + 1;
  return acc;
}, {});

const loadAuthUsers = async () => {
  try {
    if (!db?.auth?.admin?.listUsers) return [];
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    return data?.users || [];
  } catch (error) {
    console.warn('Superadmin auth user list skipped:', error.message || error);
    return [];
  }
};

exports.loginSuperadmin = async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const password = cleanText(req.body?.password, 128);
    if (!email || !password || !db?.auth?.signInWithPassword) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error || !isSuperAdminUser(data?.user)) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: normalizeRole(
          data.user.app_metadata?.role ||
          data.user.app_metadata?.user_role ||
          data.user.user_metadata?.role ||
          data.user.user_metadata?.user_role
        ).replace('_', ''),
      },
      session: data.session,
    });
  } catch (error) {
    console.error('Superadmin login failed:', error.message || error);
    return res.status(404).json({ success: false, message: 'Not found.' });
  }
};

exports.getSuperadminMe = async (req, res) => res.status(200).json({
  success: true,
  user: {
    id: req.superadmin.id,
    email: req.superadmin.email,
    role: req.superadmin.user_metadata?.role,
  },
});

exports.getOwnerOverview = async (req, res) => {
  try {
    const [authUsers, profiles, templates, inboxMessages] = await Promise.all([
      loadAuthUsers(),
      safeSelect('doctor_profiles', '*'),
      safeSelect('whatsapp_templates', '*'),
      safeSelect('inbox_messages', '*', (query) => query.gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()).limit(2000)),
    ]);

    const doctorUsers = authUsers.filter((user) => !isSuperAdminUser(user));
    const paidProfiles = profiles.filter((profile) => ['active', 'paid', 'subscription_active'].includes(String(profile.subscription_status || '').toLowerCase()));
    const trialProfiles = profiles.filter((profile) => ['trial', 'trialing'].includes(String(profile.subscription_status || '').toLowerCase()));
    const activeCutoff = Date.now() - 15 * 60 * 1000;
    const liveActiveUsers = profiles.filter((profile) => {
      const stamp = new Date(profile.last_active_at || profile.updated_at || '').getTime();
      return Number.isFinite(stamp) && stamp >= activeCutoff;
    }).length;

    const warningStatuses = new Set(['rejected', 'paused', 'disabled', 'failed']);
    const metaWarnings = templates.filter((row) => warningStatuses.has(String(row.status || '').toLowerCase()));

    return res.status(200).json({
      success: true,
      data: {
        totalRegistrations: doctorUsers.length || profiles.length,
        activeSubscriptions: {
          paid: paidProfiles.length,
          trial: trialProfiles.length,
          byTier: groupCount(profiles, 'subscription_tier', 'basic'),
          byRuntimePlan: groupCount(profiles, 'runtime_plan', 'basic'),
        },
        liveActiveUsers: liveActiveUsers || inboxMessages.length,
        metaComplianceHealth: {
          warningFlags: metaWarnings.length,
          templateWarnings: metaWarnings.slice(0, 8),
          statusBreakdown: groupCount(templates, 'status', 'unknown'),
        },
      },
    });
  } catch (error) {
    console.error('Superadmin overview failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to load owner overview.' });
  }
};

exports.getUserMatrix = async (req, res) => {
  try {
    const search = cleanText(req.query?.search || '', 80).toLowerCase();
    const [profiles, wallets, appointments, patients, teamMembers, inboxMessages, transactions, activityLogs, aiLogs] = await Promise.all([
      safeSelect('doctor_profiles', '*', (query) => query.order('created_at', { ascending: false }).limit(500)),
      safeSelect('wallets', '*'),
      safeSelect('appointments', '*'),
      safeSelect('patients_ledger', '*'),
      safeSelect('staff_members', '*'),
      safeSelect('inbox_messages', '*'),
      safeSelect('wallet_transactions', '*', (query) => query.order('created_at', { ascending: false }).limit(1000)),
      safeSelect('login_activity_logs', '*', (query) => query.order('created_at', { ascending: false }).limit(1000)),
      safeSelect('ai_usage_logs', '*', (query) => query.limit(5000)),
    ]);

    const rows = profiles
      .filter((profile) => {
        if (!search) return true;
        return [profile.name, profile.legal_name, profile.clinic_name, profile.business_name, profile.email, profile.phone, profile.mobile]
          .some((value) => String(value || '').toLowerCase().includes(search));
      })
      .map((profile) => {
        const id = profile.id || profile.user_id;
        const wallet = wallets.find((row) => row.user_id === id) || {};
        const userAppointments = appointments.filter((row) => row.user_id === id || row.doctor_id === id);
        const userPatients = patients.filter((row) => row.user_id === id || row.doctor_id === id);
        const userTeam = teamMembers.filter((row) => row.admin_id === id || row.user_id === id || row.doctor_id === id);
        const userMessages = inboxMessages.filter((row) => row.workspace_id === id || row.user_id === id || row.doctor_id === id);
        const userTransactions = transactions.filter((row) => row.user_id === id).slice(0, 8);
        const userActivity = activityLogs.filter((row) => row.user_id === id || row.doctor_id === id).slice(0, 8);
        const userAiLogs = aiLogs.filter((row) => row.user_id === id || row.doctor_id === id);
        const expiryAt = profile.subscription_end_at || profile.plan_expires_at || profile.trial_end_at;
        const expiryDays = daysUntil(expiryAt);
        const delivery = {
          totalSent: userMessages.filter((row) => row.from_me === true || ['sent', 'delivered', 'read', 'failed'].includes(String(row.status || '').toLowerCase())).length,
          delivered: userMessages.filter((row) => ['delivered', 'read'].includes(String(row.status || '').toLowerCase())).length,
          read: userMessages.filter((row) => ['read', 'opened'].includes(String(row.status || '').toLowerCase())).length,
          failed: userMessages.filter((row) => ['failed', 'undelivered', 'error'].includes(String(row.status || '').toLowerCase())).length,
        };

        return {
          id,
          legalName: profile.legal_name || profile.name || 'Unknown doctor',
          clinicName: profile.clinic_name || profile.business_name || 'Clinic Workspace',
          email: profile.email || '',
          mobile: profile.phone || profile.mobile || '',
          planTier: profile.runtime_plan || profile.plan_tier || profile.current_plan || profile.subscription_tier || 'basic',
          subscriptionStatus: profile.subscription_status || profile.status || 'unknown',
          systemStatus: String(profile.system_status || profile.status || 'ACTIVE').toUpperCase(),
          expiryAt,
          expiryDays,
          expiresSoon: expiryDays !== null && expiryDays >= 0 && expiryDays <= 3,
          walletBalance: number(wallet.balance),
          appointments: {
            total: userAppointments.length,
            pending: userAppointments.filter((row) => String(row.status || '').toLowerCase() !== 'completed').length,
            completed: userAppointments.filter((row) => String(row.status || '').toLowerCase() === 'completed').length,
          },
          totalPatients: userPatients.length,
          teamCount: userTeam.length,
          geminiTokens: userAiLogs.reduce((sum, row) => sum + number(row.tokens_used || row.total_tokens), 0) || number(wallet.token_used),
          delivery,
          transactions: userTransactions,
          activityDays: [...new Set(userActivity.map((row) => String(row.created_at || row.last_active_at || '').slice(0, 10)).filter(Boolean))],
          lastActiveAt: profile.last_active_at || userActivity[0]?.last_active_at || userActivity[0]?.created_at || profile.updated_at || profile.created_at,
        };
      });

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Superadmin user matrix failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to load user matrix.' });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const userId = cleanUuid(req.params?.userId);
    const status = cleanText(req.body?.status, 20).toUpperCase();
    if (!userId || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status request.' });
    }

    let { data, error } = await db
      .from('doctor_profiles')
      .update({ system_status: status, updated_at: nowIso() })
      .eq('id', userId)
      .select('id,system_status')
      .maybeSingle();
    if (error && isMissing(error)) {
      const fallback = await db
        .from('doctor_profiles')
        .update({ system_status: status })
        .eq('id', userId)
        .select('id,system_status')
        .maybeSingle();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'User not found.' });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Superadmin status update failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to update status.' });
  }
};

exports.adjustWallet = async (req, res) => {
  try {
    const userId = cleanUuid(req.params?.userId);
    const amount = cleanMoney(req.body?.amount);
    const reason = cleanText(req.body?.reason || 'Superadmin manual wallet adjustment', 180);
    if (!userId || amount === null || amount === 0 || Math.abs(amount) > 100000) {
      return res.status(400).json({ success: false, message: 'Invalid wallet adjustment.' });
    }

    const { data: wallet, error: walletError } = await db.from('wallets').select('user_id,balance').eq('user_id', userId).maybeSingle();
    if (walletError) throw walletError;
    const currentBalance = number(wallet?.balance);
    const nextBalance = Number(Math.max(0, currentBalance + amount).toFixed(2));

    let { error: upsertError } = await db.from('wallets').upsert({
      user_id: userId,
      balance: nextBalance,
      updated_at: nowIso(),
    }, { onConflict: 'user_id' });
    if (upsertError && isMissing(upsertError)) {
      const fallback = await db.from('wallets').upsert({
        user_id: userId,
        balance: nextBalance,
      }, { onConflict: 'user_id' });
      upsertError = fallback.error;
    }
    if (upsertError) throw upsertError;

    await db.from('wallet_transactions').insert([{
      user_id: userId,
      amount: Math.abs(amount),
      transaction_type: amount > 0 ? 'CREDIT' : 'DEBIT',
      description: reason,
      metadata: {
        source: 'superadmin_manual_adjustment',
        adjusted_by: req.superadmin?.id || null,
        balance_before: currentBalance,
        balance_after: nextBalance,
      },
      created_at: nowIso(),
    }]).catch((error) => {
      console.warn('Superadmin wallet audit insert skipped:', error.message || error);
    });

    return res.status(200).json({ success: true, data: { user_id: userId, balance: nextBalance } });
  } catch (error) {
    console.error('Superadmin wallet adjustment failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to adjust wallet.' });
  }
};
