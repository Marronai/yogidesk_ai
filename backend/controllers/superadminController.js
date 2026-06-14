const { supabaseAdmin } = require('../config/supabase');
const crypto = require('crypto');
const {
  cleanEmail,
  cleanMoney,
  cleanText,
  cleanUuid,
  isSuperAdminUser,
  normalizeRole,
} = require('../utils/superadminSecurity');
const {
  SUPERADMIN_PERMISSION_KEYS,
  fullPermissions,
  loadInternalStaff,
  rowPermissions,
} = require('../middleware/superadminGate');

const db = supabaseAdmin;
const nowIso = () => new Date().toISOString();
const SHADOW_TOKEN_PREFIX = 'superadmin-shadow-token-';
const getShadowSecret = () => (
  process.env.SUPERADMIN_SHADOW_SECRET ||
  process.env.JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'yogidesk-superadmin-shadow-secret'
);
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const formatInr = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(number(value));
const isMissing = (error) => {
  const text = String(`${error?.message || ''} ${error?.details || ''}`).toLowerCase();
  return ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error?.code) || text.includes('schema cache') || text.includes('does not exist');
};
const daysUntil = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.ceil(ms / 86400000) : null;
};
const superadminStaffColumns = `id,name,email,auth_user_id,is_active,status,${SUPERADMIN_PERMISSION_KEYS.join(',')},invited_by,created_at,updated_at`;
const isOwnerSuperadmin = (req) => req.superadminRole === 'owner' || isSuperAdminUser(req.superadmin) || Boolean(req.superAdminUser);
const hasPermission = (req, permission) => isOwnerSuperadmin(req) || Boolean(req.superadminPermissions?.[permission]);
const requirePermission = (req, res, permission) => {
  if (hasPermission(req, permission)) return true;
  res.status(403).json({ success: false, message: 'This super admin staff account does not have permission for this action.' });
  return false;
};
const sanitizePermissions = (input = {}) => SUPERADMIN_PERMISSION_KEYS.reduce((acc, key) => {
  acc[key] = Boolean(input[key]);
  return acc;
}, {});

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

const findClinicForUser = async (userId, columns = 'id,user_id,is_blocked,clinic_name,name') => {
  const filters = [
    (query) => query.eq('user_id', userId),
    (query) => query.eq('doctor_id', userId),
    (query) => query.eq('owner_id', userId),
    (query) => query.eq('id', userId),
  ];

  for (const applyFilter of filters) {
    try {
      const { data, error } = await applyFilter(db.from('clinics').select(columns)).limit(1).maybeSingle();
      if (!error && data?.id) return data;
      if (error && !isMissing(error)) throw error;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  return null;
};

const base64Url = (value) => Buffer.from(value).toString('base64url');
const signShadowPayload = (payload) => {
  const body = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getShadowSecret())
    .update(body)
    .digest('base64url');
  return `${SHADOW_TOKEN_PREFIX}${body}.${signature}`;
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
    if (error || !data?.user) {
      return res.status(404).json({ success: false, message: 'Not found.' });
    }

    const owner = isSuperAdminUser(data.user);
    const staff = owner ? null : await loadInternalStaff(data.user);
    if (!owner && !staff?.id) return res.status(404).json({ success: false, message: 'Not found.' });

    return res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: owner ? normalizeRole(
          data.user.app_metadata?.role ||
          data.user.app_metadata?.user_role ||
          data.user.user_metadata?.role ||
          data.user.user_metadata?.user_role
        ).replace('_', '') : 'superadmin_staff',
        staffId: staff?.id || null,
        permissions: owner ? fullPermissions() : rowPermissions(staff),
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
    role: isOwnerSuperadmin(req) ? 'superadmin' : 'superadmin_staff',
    staffId: req.superadminStaff?.id || null,
    name: req.superadminStaff?.name || req.superadmin.user_metadata?.name || req.superadmin.email,
  },
  permissions: req.superadminPermissions || {},
  isOwner: isOwnerSuperadmin(req),
});

exports.listSuperadminStaff = async (req, res) => {
  try {
    if (!isOwnerSuperadmin(req)) {
      return res.status(403).json({ success: false, message: 'Only the owner super admin can view internal staff.' });
    }
    const { data, error } = await db
      .from('superadmin_staff')
      .select(superadminStaffColumns)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Superadmin staff list failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to load internal staff.' });
  }
};

exports.inviteSuperadminStaff = async (req, res) => {
  try {
    if (!isOwnerSuperadmin(req)) {
      return res.status(403).json({ success: false, message: 'Only the owner super admin can invite internal staff.' });
    }

    const name = cleanText(req.body?.name || req.body?.staffName, 120);
    const email = cleanEmail(req.body?.email || req.body?.staffEmail);
    const permissions = sanitizePermissions(req.body?.permissions || req.body || {});
    if (!name || !email) return res.status(400).json({ success: false, message: 'Staff name and email are required.' });
    if (!Object.values(permissions).some(Boolean)) {
      return res.status(400).json({ success: false, message: 'Select at least one permission for this internal staff member.' });
    }

    let authUserId = null;
    if (db?.auth?.admin?.listUsers) {
      const { data: authList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const matched = (authList?.users || []).find((user) => String(user.email || '').toLowerCase() === email);
      authUserId = matched?.id || null;
    }

    const payload = {
      name,
      email,
      is_active: true,
      status: authUserId ? 'ACTIVE' : 'INVITED',
      invited_by: req.superadmin?.id || null,
      updated_at: nowIso(),
      ...permissions,
    };
    if (authUserId) payload.auth_user_id = authUserId;

    const { data, error } = await db
      .from('superadmin_staff')
      .upsert(payload, { onConflict: 'email' })
      .select(superadminStaffColumns)
      .single();
    if (error) throw error;

    return res.status(201).json({
      success: true,
      data,
      message: authUserId
        ? 'Internal staff access mapped to the existing auth account.'
        : 'Internal staff invitation saved. The user can access Super Admin after their auth account is created with this email.',
    });
  } catch (error) {
    console.error('Superadmin staff invite failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to invite internal staff.' });
  }
};

exports.getOwnerOverview = async (req, res) => {
  try {
    if (!requirePermission(req, res, 'can_view_owner_overview')) return;
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
    if (!requirePermission(req, res, 'can_view_universal_matrix')) return;
    const search = cleanText(req.query?.search || '', 80).toLowerCase();
    const [authUsers, profiles, clinics, wallets, appointments, patients, teamMembers, inboxMessages, transactions, activityLogs, aiLogs, subscriptionEvents] = await Promise.all([
      loadAuthUsers(),
      safeSelect('doctor_profiles', '*', (query) => query.order('created_at', { ascending: false }).limit(500)),
      safeSelect('clinics', '*'),
      safeSelect('wallets', '*'),
      safeSelect('appointments', '*'),
      safeSelect('patients_ledger', '*'),
      safeSelect('staff_members', '*'),
      safeSelect('inbox_messages', '*'),
      safeSelect('wallet_transactions', '*', (query) => query.order('created_at', { ascending: false }).limit(1000)),
      safeSelect('login_activity_logs', '*', (query) => query.order('created_at', { ascending: false }).limit(1000)),
      safeSelect('ai_usage_logs', '*', (query) => query.limit(5000)),
      safeSelect('subscription_events', '*', (query) => query.order('created_at', { ascending: false }).limit(1000)),
    ]);

    const profileIds = new Set(profiles.map((profile) => profile.id || profile.user_id).filter(Boolean));
    const profileRows = [
      ...profiles,
      ...authUsers
        .filter((user) => !isSuperAdminUser(user) && !profileIds.has(user.id))
        .map((user) => ({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.user_metadata?.full_name || user.email,
          clinic_name: user.user_metadata?.clinic_name || user.user_metadata?.businessName || 'Clinic Workspace',
          created_at: user.created_at,
          updated_at: user.updated_at || user.last_sign_in_at,
          last_active_at: user.last_sign_in_at,
        })),
    ];

    const rows = profileRows
      .filter((profile) => {
        if (!search) return true;
        return [profile.name, profile.legal_name, profile.clinic_name, profile.business_name, profile.email, profile.phone, profile.mobile]
          .some((value) => String(value || '').toLowerCase().includes(search));
      })
      .map((profile) => {
        const id = profile.id || profile.user_id;
        const authUser = authUsers.find((row) => row.id === id) || {};
        const clinic = clinics.find((row) => row.user_id === id || row.doctor_id === id || row.owner_id === id || row.id === id) || {};
        const wallet = wallets.find((row) => row.user_id === id) || {};
        const userAppointments = appointments.filter((row) => row.user_id === id || row.doctor_id === id);
        const userPatients = patients.filter((row) => row.user_id === id || row.doctor_id === id || row.clinic_id === clinic.id);
        const userTeam = teamMembers.filter((row) => row.admin_id === id || row.user_id === id || row.doctor_id === id || row.clinic_id === clinic.id);
        const userMessages = inboxMessages.filter((row) => row.workspace_id === id || row.user_id === id || row.doctor_id === id || row.clinic_id === clinic.id);
        const userTransactions = transactions.filter((row) => row.user_id === id).slice(0, 8);
        const userActivity = activityLogs.filter((row) => row.user_id === id || row.doctor_id === id).slice(0, 8);
        const userAiLogs = aiLogs.filter((row) => row.user_id === id || row.doctor_id === id);
        const userSubscriptions = subscriptionEvents.filter((row) => row.user_id === id || row.doctor_id === id || row.clinic_id === clinic.id);
        const expiryAt = profile.subscription_end_at || profile.plan_expires_at || profile.trial_end_at;
        const expiryDays = daysUntil(expiryAt);
        const planTier = clinic.runtime_plan || clinic.current_plan || clinic.plan_tier || clinic.subscription_tier || profile.runtime_plan || profile.plan_tier || profile.current_plan || profile.subscription_tier || 'basic';
        const delivery = {
          totalSent: userMessages.filter((row) => row.from_me === true || ['sent', 'delivered', 'read', 'failed'].includes(String(row.status || '').toLowerCase())).length,
          delivered: userMessages.filter((row) => ['delivered', 'read'].includes(String(row.status || '').toLowerCase())).length,
          read: userMessages.filter((row) => ['read', 'opened'].includes(String(row.status || '').toLowerCase())).length,
          failed: userMessages.filter((row) => ['failed', 'undelivered', 'error'].includes(String(row.status || '').toLowerCase())).length,
        };

        return {
          id,
          clinicId: clinic.id || null,
          legalName: profile.legal_name || profile.name || authUser.user_metadata?.name || authUser.user_metadata?.full_name || 'Unknown doctor',
          clinicName: clinic.clinic_name || clinic.name || profile.clinic_name || profile.business_name || 'Clinic Workspace',
          email: profile.email || authUser.email || '',
          mobile: clinic.phone || clinic.phone_number || profile.phone || profile.mobile || authUser.phone || '',
          planTier,
          subscriptionStatus: clinic.subscription_status || profile.subscription_status || profile.status || 'unknown',
          systemStatus: clinic.is_blocked ? 'SUSPENDED' : String(profile.system_status || profile.status || 'ACTIVE').toUpperCase(),
          isBlocked: Boolean(clinic.is_blocked),
          expiryAt,
          expiryDays,
          expiresSoon: expiryDays !== null && expiryDays >= 0 && expiryDays <= 3,
          walletBalance: number(wallet.balance),
          walletBalanceLabel: formatInr(wallet.balance),
          appointments: {
            total: userAppointments.length,
            pending: userAppointments.filter((row) => String(row.status || '').toLowerCase() !== 'completed').length,
            completed: userAppointments.filter((row) => String(row.status || '').toLowerCase() === 'completed').length,
          },
          totalPatients: userPatients.length,
          teamCount: userTeam.length,
          geminiTokens: userAiLogs.reduce((sum, row) => sum + number(row.tokens_used || row.total_tokens), 0) || number(wallet.token_used),
          aiMessagesProcessed: userMessages.length + userAiLogs.length,
          subscriptionEvents: userSubscriptions.length,
          delivery,
          transactions: userTransactions,
          activityDays: [...new Set(userActivity.map((row) => String(row.created_at || row.last_active_at || '').slice(0, 10)).filter(Boolean))],
          lastActiveAt: authUser.last_sign_in_at || profile.last_active_at || userActivity[0]?.last_active_at || userActivity[0]?.created_at || profile.updated_at || profile.created_at,
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
    if (!requirePermission(req, res, 'can_use_kill_switch')) return;
    const userId = cleanUuid(req.params?.userId);
    const requestedBlocked = typeof req.body?.isBlocked === 'boolean' ? req.body.isBlocked : null;
    const status = cleanText(req.body?.status, 20).toUpperCase();
    const isBlocked = requestedBlocked !== null ? requestedBlocked : status === 'SUSPENDED';
    if (!userId || (requestedBlocked === null && !['ACTIVE', 'SUSPENDED'].includes(status))) {
      return res.status(400).json({ success: false, message: 'Invalid status request.' });
    }

    const clinic = await findClinicForUser(userId, 'id,user_id,is_blocked');
    if (!clinic?.id) return res.status(404).json({ success: false, message: 'Clinic workspace not found.' });

    let clinicUpdate = await db
      .from('clinics')
      .update({ is_blocked: isBlocked, updated_at: nowIso() })
      .eq('id', clinic.id)
      .select('id,user_id,is_blocked')
      .maybeSingle();
    if (clinicUpdate.error && isMissing(clinicUpdate.error)) {
      clinicUpdate = await db
        .from('clinics')
        .update({ is_blocked: isBlocked })
        .eq('id', clinic.id)
        .select('id,user_id,is_blocked')
        .maybeSingle();
    }
    if (clinicUpdate.error) throw clinicUpdate.error;

    await db
      .from('doctor_profiles')
      .update({ system_status: isBlocked ? 'SUSPENDED' : 'ACTIVE', updated_at: nowIso() })
      .eq('id', userId);

    return res.status(200).json({
      success: true,
      data: {
        id: userId,
        clinicId: clinic.id,
        isBlocked,
        systemStatus: isBlocked ? 'SUSPENDED' : 'ACTIVE',
      },
    });
  } catch (error) {
    console.error('Superadmin status update failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to update status.' });
  }
};

exports.createImpersonationSession = async (req, res) => {
  try {
    if (!requirePermission(req, res, 'can_view_universal_matrix')) return;
    const userId = cleanUuid(req.params?.userId);
    if (!userId) return res.status(400).json({ success: false, message: 'Invalid user request.' });

    const clinic = await findClinicForUser(userId);
    if (!clinic?.id) return res.status(404).json({ success: false, message: 'Clinic workspace not found.' });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const shadowToken = signShadowPayload({
      sub: userId,
      clinic_id: clinic.id,
      mode: 'superadmin_shadow_audit',
      by: req.superadmin?.id || null,
      exp: Math.floor(new Date(expiresAt).getTime() / 1000),
      iat: Math.floor(Date.now() / 1000),
    });
    return res.status(200).json({
      success: true,
      data: {
        token: shadowToken,
        userId,
        clinicId: clinic.id,
        clinicName: clinic.clinic_name || clinic.name || 'Clinic Workspace',
        expiresAt,
        audit: {
          impersonatedBy: req.superadmin?.id || null,
          mode: 'superadmin_shadow_audit',
        },
      },
    });
  } catch (error) {
    console.error('Superadmin impersonation failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to create shadow audit session.' });
  }
};

exports.adjustWallet = async (req, res) => {
  try {
    if (!requirePermission(req, res, 'can_override_plan_wallet')) return;
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
