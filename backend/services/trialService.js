const MS_PER_HOUR = 60 * 60 * 1000;

const PLAN_LIMITS = {
  STARTER: { patient_limit: 500, staff_limit: 1, template_limit: 20 },
  GROWTH: { patient_limit: 2000, staff_limit: 3, template_limit: 50 },
  MULTI_SPECIALTY: { patient_limit: 10000, staff_limit: 10, template_limit: 100 },
};

const normalizeTier = (tier = 'GROWTH') => {
  const value = String(tier || 'GROWTH').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (value.includes('MULTI')) return 'MULTI_SPECIALTY';
  if (value.includes('STARTER')) return 'STARTER';
  return 'GROWTH';
};

const getPlanLimits = (tier) => PLAN_LIMITS[normalizeTier(tier)] || PLAN_LIMITS.GROWTH;

const buildTrialProfilePayload = ({
  userId,
  email,
  name,
  businessName,
  businessCategory,
  phone,
}) => {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 24 * MS_PER_HOUR);
  return {
    id: userId,
    email: email || null,
    name: name || 'Doctor',
    clinic_name: businessName || null,
    business_name: businessName || null,
    business_category: businessCategory || null,
    clinic_category: businessCategory || null,
    specialization: businessCategory || null,
    phone_number: phone || null,
    subscription_tier: 'GROWTH',
    subscription_status: 'trialing',
    trial_start_at: now.toISOString(),
    trial_end_at: trialEnd.toISOString(),
    wallet_balance: 50.00,
    onboarding_tour_completed: false,
    trial_last_reminder_at: null,
    plan_limits: getPlanLimits('GROWTH'),
    updated_at: now.toISOString(),
  };
};

const ensurePremiumTrialProfile = async (db, payload) => {
  if (!db?.from || !payload?.userId) return { data: null, error: null };

  const row = buildTrialProfilePayload(payload);
  const result = await db
    .from('doctor_profiles')
    .upsert(row, { onConflict: 'id' })
    .select('*')
    .maybeSingle();

  if (result.error) return result;

  await db.from('wallets').upsert({
    user_id: payload.userId,
    balance: 50.00,
    is_first_recharge: true,
    welcome_gift_active: true,
    current_plan: 'growth',
    plan_tier: 'Growth Clinic',
    lifetime_contacts_count: 0,
  }, { onConflict: 'user_id', ignoreDuplicates: true });

  return result;
};

const buildTrialReminderHtml = ({ name = 'Doctor', hoursLeft = 48 }) => `
  <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden">
      <div style="background:#ff6a00;padding:22px 26px;color:#ffffff">
        <h1 style="margin:0;font-size:22px">Your Premium trial expires in ${hoursLeft} hours</h1>
      </div>
      <div style="padding:26px">
        <p style="font-size:16px;line-height:1.6;margin-top:0">Hi Dr. ${name},</p>
        <p style="font-size:16px;line-height:1.6">Your Yogi Desk Premium Access is about to expire. Your multi-staff team configurations, patient automation logs, template workflows, and active clinic analytics will freeze unless you select a permanent tier.</p>
        <p style="font-size:16px;line-height:1.6">Upgrade now to keep your receptionist workflows, connected Meta numbers, and patient communication history running without interruption.</p>
        <div style="margin:28px 0">
          <a href="https://yogidesk-ai.com/pricing" style="display:inline-block;background:#ff6a00;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:800">Choose Permanent Tier</a>
        </div>
        <p style="font-size:13px;color:#64748b">Direct link: https://yogidesk-ai.com/pricing</p>
      </div>
    </div>
  </div>
`;

const startTrialReminderJob = ({ db, sendDirectEmail, intervalMs = 24 * MS_PER_HOUR }) => {
  if (!db?.from || typeof sendDirectEmail !== 'function') {
    console.warn('Trial reminder job skipped: database or mail sender unavailable.');
    return null;
  }

  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 48 * MS_PER_HOUR);
      const dayAgo = new Date(now.getTime() - 24 * MS_PER_HOUR);

      const { data, error } = await db
        .from('doctor_profiles')
        .select('id,email,name,trial_end_at,trial_last_reminder_at,subscription_status')
        .lte('trial_end_at', windowEnd.toISOString())
        .gte('trial_end_at', now.toISOString())
        .in('subscription_status', ['trialing', 'trial']);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      for (const profile of rows) {
        if (!profile.email) continue;
        const lastSentAt = profile.trial_last_reminder_at ? new Date(profile.trial_last_reminder_at) : null;
        if (lastSentAt && lastSentAt > dayAgo) continue;

        const hoursLeft = Math.max(1, Math.ceil((new Date(profile.trial_end_at).getTime() - now.getTime()) / MS_PER_HOUR));
        await sendDirectEmail(
          profile.email,
          `\u26A0\uFE0F Action Required: Your Yogi Desk Premium Access Expires in ${hoursLeft} Hours!`,
          buildTrialReminderHtml({ name: profile.name, hoursLeft }),
          'retention'
        );

        await db
          .from('doctor_profiles')
          .update({ trial_last_reminder_at: new Date().toISOString() })
          .eq('id', profile.id);
      }
    } catch (error) {
      console.error('Trial reminder job failed:', error.message || error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(run, intervalMs);
  run();
  return timer;
};

const activateSubscriptionTier = async ({ db, userId, tier, paymentReference }) => {
  if (!db?.from || !userId) throw new Error('Subscription activation requires a valid database and user.');

  const normalizedTier = normalizeTier(tier);
  const now = new Date().toISOString();
  const payload = {
    subscription_tier: normalizedTier,
    subscription_status: 'active',
    active_subscription_started_at: now,
    plan_limits: getPlanLimits(normalizedTier),
    updated_at: now,
  };

  const { data, error } = await db
    .from('doctor_profiles')
    .update(payload)
    .eq('id', userId)
    .select('id,subscription_tier,subscription_status,plan_limits')
    .maybeSingle();

  if (error) throw error;

  await db.from('subscription_events').insert([{
    user_id: userId,
    tier: normalizedTier,
    event_type: 'subscription_activated',
    payment_reference: paymentReference || null,
    metadata: {
      data_integrity: 'patient rows, campaign history, and Meta connection rows intentionally untouched',
      plan_limits: payload.plan_limits,
    },
    created_at: now,
  }]).then(({ error: insertError }) => {
    if (insertError) console.warn('Subscription event log skipped:', insertError.message || insertError);
  });

  return data;
};

module.exports = {
  activateSubscriptionTier,
  ensurePremiumTrialProfile,
  getPlanLimits,
  normalizeTier,
  startTrialReminderJob,
};
