const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const META_REVIEWER_EMAIL = 'meta-tester@yogidesk-ai.com';
const META_REVIEWER_PASSWORD = 'YogiTester@2026';
const META_REVIEWER_NAME = 'Dr. Meta Reviewer';
const META_REVIEWER_SPECIALIZATION = 'Dentist';
const BCRYPT_ROUNDS = Number(process.env.AUTH_BCRYPT_ROUNDS || 10);

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const isMetaReviewerEmail = (email) => normalizeEmail(email) === META_REVIEWER_EMAIL;

const getMissingColumnName = (error) => {
  const message = String(error?.message || error?.details || '');
  const match = message.match(/'([^']+)' column/i) || message.match(/column "?([a-zA-Z0-9_]+)"?/i);
  return match?.[1] || '';
};

const isMissingTableError = (error) => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return error?.code === '42P01' || error?.code === 'PGRST205' || message.includes('does not exist');
};

const pruneMissingColumns = async (operation, row, attempts = 10) => {
  let safeRow = { ...row };
  let lastResult = { data: null, error: null };

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    lastResult = await operation(safeRow);
    if (!lastResult.error) return lastResult;

    const missingColumn = getMissingColumnName(lastResult.error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(safeRow, missingColumn)) break;
    delete safeRow[missingColumn];
  }

  return lastResult;
};

const findAuthUserByEmail = async (db) => {
  if (!db?.auth?.admin?.listUsers) return null;

  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage });
    if (error) return null;

    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find((user) => isMetaReviewerEmail(user.email));
    if (match?.id) return match;
    if (users.length < perPage) break;
  }

  return null;
};

const ensureSupabaseAuthUser = async (db) => {
  if (!db?.auth?.admin?.createUser) return null;

  const existing = await findAuthUserByEmail(db);
  if (existing?.id) {
    if (db.auth.admin.updateUserById) {
      await db.auth.admin.updateUserById(existing.id, {
        password: META_REVIEWER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          ...(existing.user_metadata || {}),
          name: META_REVIEWER_NAME,
          specialization: META_REVIEWER_SPECIALIZATION,
          meta_app_reviewer: true,
        },
      }).catch(() => {});
    }
    return existing.id;
  }

  const { data, error } = await db.auth.admin.createUser({
    email: META_REVIEWER_EMAIL,
    password: META_REVIEWER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: META_REVIEWER_NAME,
      specialization: META_REVIEWER_SPECIALIZATION,
      meta_app_reviewer: true,
    },
  });

  if (error) {
    const afterConflict = await findAuthUserByEmail(db);
    if (afterConflict?.id) return afterConflict.id;
    throw error;
  }

  return data?.user?.id || null;
};

const ensurePublicUserRow = async (db, authUserId, hashedPassword) => {
  if (!db?.from) return null;

  const existing = await db
    .from('users')
    .select('id,email')
    .eq('email', META_REVIEWER_EMAIL)
    .maybeSingle();

  if (existing.error && isMissingTableError(existing.error)) return authUserId;
  if (existing.error) throw existing.error;

  const userId = existing.data?.id || authUserId || crypto.randomUUID();
  const row = {
    id: userId,
    email: META_REVIEWER_EMAIL,
    name: META_REVIEWER_NAME,
    full_name: META_REVIEWER_NAME,
    password: hashedPassword,
    password_hash: hashedPassword,
    role: 'user',
    is_verified: true,
    isVerified: true,
    email_verified: true,
    email_otp_verified: true,
    phone_otp_verified: true,
    specialization: META_REVIEWER_SPECIALIZATION,
    plan_tier: 'growth',
    current_plan: 'growth',
    subscription_tier: 'growth',
    subscription_status: 'active',
    meta_app_reviewer: true,
    updated_at: new Date().toISOString(),
  };

  const result = await pruneMissingColumns(
    (safeRow) => db
      .from('users')
      .upsert(safeRow, { onConflict: 'id' })
      .select('id')
      .maybeSingle(),
    row
  );

  if (result.error && !isMissingTableError(result.error)) throw result.error;
  return result.data?.id || userId;
};

const ensureDoctorProfileRow = async (db, userId) => {
  if (!db?.from || !userId) return null;

  const now = new Date().toISOString();
  const row = {
    id: userId,
    email: META_REVIEWER_EMAIL,
    name: META_REVIEWER_NAME,
    full_name: META_REVIEWER_NAME,
    specialization: META_REVIEWER_SPECIALIZATION,
    clinic_category: META_REVIEWER_SPECIALIZATION,
    business_category: META_REVIEWER_SPECIALIZATION,
    plan_tier: 'growth',
    current_plan: 'growth',
    subscription_tier: 'growth',
    subscription_status: 'active',
    payment_confirmed: true,
    subscription_paid: true,
    is_paid: true,
    lifetime_patients_limit: 2000,
    ai_token_balance: 1000,
    has_trial_expired: false,
    trial_start_at: now,
    trial_end_at: null,
    trial_last_reminder_at: null,
    wallet_balance: 50.00,
    onboarding_tour_completed: true,
    is_ai_paused: false,
    meta_app_reviewer: true,
    plan_limits: { patient_limit: 2000, staff_limit: 2, template_limit: 50 },
    updated_at: now,
  };

  const result = await pruneMissingColumns(
    (safeRow) => db
      .from('doctor_profiles')
      .upsert(safeRow, { onConflict: 'id' })
      .select('id')
      .maybeSingle(),
    row
  );

  if (result.error) throw result.error;
  return result.data?.id || userId;
};

const ensureWalletRow = async (db, userId) => {
  if (!db?.from || !userId) return;

  const row = {
    user_id: userId,
    balance: 50.00,
    is_first_recharge: true,
    welcome_gift_active: true,
    current_plan: 'growth',
    plan_tier: 'growth',
    lifetime_contacts_count: 0,
  };

  const result = await pruneMissingColumns(
    (safeRow) => db.from('wallets').upsert(safeRow, { onConflict: 'user_id' }),
    row
  );

  if (result.error && !isMissingTableError(result.error)) {
    console.warn('[Meta Reviewer Seed] Wallet seed skipped:', result.error.message || result.error);
  }
};

const ensureMongoUser = async (User) => {
  if (!User?.findOne) return null;

  let user = await User.findOne({ email: META_REVIEWER_EMAIL }).select('+password');
  if (!user && User.create) {
    user = await User.create({
      name: META_REVIEWER_NAME,
      email: META_REVIEWER_EMAIL,
      password: META_REVIEWER_PASSWORD,
      role: 'user',
      isVerified: true,
      businessName: 'Meta Reviewer Clinic',
      businessType: 'Clinic',
      businessCategory: META_REVIEWER_SPECIALIZATION,
      planType: 'growth',
      subscriptionStatus: 'active',
    });
  } else if (user) {
    user.name = user.name || META_REVIEWER_NAME;
    user.role = user.role || 'user';
    user.isVerified = true;
    user.businessCategory = user.businessCategory || META_REVIEWER_SPECIALIZATION;
    user.subscriptionStatus = 'active';
    const passwordMatches = user.password
      ? await bcrypt.compare(META_REVIEWER_PASSWORD, user.password).catch(() => false)
      : false;
    if (!passwordMatches) user.password = META_REVIEWER_PASSWORD;
    if (typeof user.save === 'function') await user.save();
  }

  return user;
};

const ensureMetaReviewerAccount = async ({ db, User } = {}) => {
  if (!db?.from && !User) return { ensured: false, reason: 'database unavailable' };

  const hashedPassword = await bcrypt.hash(META_REVIEWER_PASSWORD, BCRYPT_ROUNDS);
  const authUserId = await ensureSupabaseAuthUser(db).catch((error) => {
    console.warn('[Meta Reviewer Seed] Supabase Auth user seed skipped:', error.message || error);
    return null;
  });
  const userId = await ensurePublicUserRow(db, authUserId, hashedPassword);
  await ensureDoctorProfileRow(db, userId);
  await ensureWalletRow(db, userId);
  await ensureMongoUser(User).catch((error) => {
    console.warn('[Meta Reviewer Seed] Mongo mirror skipped:', error.message || error);
  });

  return { ensured: true, userId, email: META_REVIEWER_EMAIL };
};

module.exports = {
  ensureMetaReviewerAccount,
  isMetaReviewerEmail,
  META_REVIEWER_EMAIL,
  META_REVIEWER_NAME,
  META_REVIEWER_PASSWORD,
};
