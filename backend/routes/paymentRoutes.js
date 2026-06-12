const express = require('express');
const crypto = require('crypto');
const path = require('path');
const Razorpay = require('razorpay');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabaseAdmin, supabase } = require('../config/supabase');
const { createWalletOrder, verifyWalletPayment } = require('../controllers/walletController');
const {
  buildFixedPlanLineItems,
  calculateMetaFee: calculateSharedMetaFee,
  createRazorpayNativeInvoice,
  normalizeInvoiceContact: normalizeSharedInvoiceContact,
  toPaise: sharedToPaise,
} = require('../services/razorpayInvoiceService');
const { sendAiCreditInvoiceEmail } = require('../services/aiCreditInvoiceMailer');

const router = express.Router();
const db = supabaseAdmin || supabase;

const PAYU_TEST_MERCHANT_KEY = 'gtK42w';
const PAYU_TEST_MERCHANT_SALT = 'eCw7YixuWn';
const isPayuSandbox = String(process.env.PAYU_SANDBOX_MODE || 'true').toLowerCase() !== 'false';
const PAYU_CHECKOUT_URL = process.env.PAYU_CHECKOUT_URL || (isPayuSandbox ? 'https://test.payu.in/_payment' : 'https://secure.payu.in/_payment');
const FRONTEND_WALLET_URL = 'https://yogidesk-ai.com/dashboard/wallet';
const FRONTEND_PRICING_URL = 'https://yogidesk-ai.com/pricing';
const API_BASE_URL = 'https://api.yogidesk-ai.com';
const { activateSubscriptionTier } = require('../services/trialService');
const SECURE_PLAN_CATALOG = Object.freeze({
  starter_3m: { planId: 'starter_3m', tier: 'STARTER', label: 'Starter Clinic - 3 Months', amountPaise: 199 * 3 * 100 },
  starter_6m: { planId: 'starter_6m', tier: 'STARTER', label: 'Starter Clinic - 6 Months', amountPaise: 169 * 6 * 100 },
  starter_12m: { planId: 'starter_12m', tier: 'STARTER', label: 'Starter Clinic - 1 Year', amountPaise: 139 * 12 * 100 },
  growth_3m: { planId: 'growth_3m', tier: 'GROWTH', label: 'Growth Clinic - 3 Months', amountPaise: 399 * 3 * 100 },
  growth_6m: { planId: 'growth_6m', tier: 'GROWTH', label: 'Growth Clinic - 6 Months', amountPaise: 339 * 6 * 100 },
  growth_12m: { planId: 'growth_12m', tier: 'GROWTH', label: 'Growth Clinic - 1 Year', amountPaise: 279 * 12 * 100 },
  multi_3m: { planId: 'multi_3m', tier: 'MULTI_SPECIALTY', label: 'Multi-Specialty - 3 Months', amountPaise: 799 * 3 * 100 },
  multi_6m: { planId: 'multi_6m', tier: 'MULTI_SPECIALTY', label: 'Multi-Specialty - 6 Months', amountPaise: 679 * 6 * 100 },
  multi_12m: { planId: 'multi_12m', tier: 'MULTI_SPECIALTY', label: 'Multi-Specialty - 1 Year', amountPaise: 559 * 12 * 100 },
});

const AI_MESSAGE_SLABS = Object.freeze({
  tier_1_ai: { packageId: 'tier_1_ai', label: 'Starter Clinic AI', amount: 299, messages: 5000 },
  tier_2_ai: { packageId: 'tier_2_ai', label: 'Growth Clinic AI', amount: 599, messages: 13000 },
  tier_3_ai: { packageId: 'tier_3_ai', label: 'Premium Care AI', amount: 999, messages: 32000 },
  tier_4_ai: { packageId: 'tier_4_ai', label: 'Medical Pro Enterprise AI', amount: 1999, messages: 60000 },
});
const AI_CUSTOM_MIN_AMOUNT = 100;
const AI_CUSTOM_MAX_AMOUNT = 1999;
const AI_CUSTOM_MESSAGE_FACTOR = 5000 / 299;
const META_FEE_RATE = 0.0236;
const AI_FIXED_SLAB_BY_AMOUNT = Object.freeze(
  Object.values(AI_MESSAGE_SLABS).reduce((lookup, slab) => ({
    ...lookup,
    [slab.amount]: slab,
  }), {})
);

const calculateAiMessagesForAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < AI_CUSTOM_MIN_AMOUNT) return 0;
  const fixedSlab = AI_FIXED_SLAB_BY_AMOUNT[value];
  if (fixedSlab) return fixedSlab.messages;
  return Math.floor(value * AI_CUSTOM_MESSAGE_FACTOR);
};

const calculateMetaFee = (amount) => Number((Number(amount || 0) * META_FEE_RATE).toFixed(2));
const toPaise = (amount) => Math.round(Number(amount || 0) * 100);

const normalizeInvoiceContact = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
};

const resolveDoctorBillingProfile = async (userId, fallback = {}) => {
  const base = {
    name: fallback.name || fallback.doctor_name || fallback.full_name || 'Doctor',
    email: fallback.email || fallback.doctor_email || '',
    contact: normalizeInvoiceContact(fallback.contact || fallback.phone || fallback.doctor_phone || ''),
  };

  if (!userId || !db?.from) return base;

  for (const table of ['doctor_profiles', 'profiles']) {
    try {
      const { data, error } = await db
        .from(table)
        .select('id,name,email,phone,phone_number,mobile,clinic_name')
        .eq('id', userId)
        .maybeSingle();
      if (!error && data?.id) {
        return {
          name: data.name || data.clinic_name || base.name,
          email: data.email || base.email,
          contact: normalizeInvoiceContact(data.phone_number || data.phone || data.mobile || base.contact),
        };
      }
    } catch (error) {
      console.warn(`Razorpay invoice billing profile lookup skipped in ${table}:`, error.message || error);
    }
  }

  try {
    if (supabaseAdmin?.auth?.admin?.getUserById) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      const authUser = data?.user;
      if (!error && authUser?.id) {
        return {
          name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || base.name,
          email: authUser.email || base.email,
          contact: normalizeInvoiceContact(authUser.user_metadata?.phone || base.contact),
        };
      }
    }
  } catch (error) {
    console.warn('Razorpay invoice auth profile lookup skipped:', error.message || error);
  }

  return base;
};

const createRazorpayAiInvoice = async ({ client, userId, recharge, razorpayOrderId, razorpayPaymentId, fallbackDoctor = {} }) => {
  try {
    if (!client?.invoices?.create) return null;
    const billing = await resolveDoctorBillingProfile(userId, fallbackDoctor);
    const packageName = recharge.packageLabel || 'AI Assistant Messages';
    const messages = Number(recharge.aiMessages || 0);
    const subtotal = Number(recharge.subtotal || 0);
    const metaFee = Number(recharge.metaFee || calculateMetaFee(subtotal));
    const lineItems = [
      {
        name: `${packageName} - ${messages.toLocaleString('en-IN')} Messages Package`,
        description: 'YogiDesk AI Assistant message credits',
        amount: toPaise(subtotal),
        currency: 'INR',
        quantity: 1,
      },
    ];

    if (metaFee > 0) {
      lineItems.push({
        name: 'Meta Fee (Infrastructure & Platform Charges)',
        description: 'Dynamic 2.36% compute and payment processing fee',
        amount: toPaise(metaFee),
        currency: 'INR',
        quantity: 1,
      });
    }
    const customer = {
      name: billing.name,
      ...(billing.email ? { email: billing.email } : {}),
      ...(billing.contact ? { contact: billing.contact } : {}),
    };

    return await client.invoices.create({
      type: 'invoice',
      description: `YogiDesk AI Assistant credits invoice for ${packageName}`,
      customer,
      line_items: lineItems,
      sms_notify: 1,
      email_notify: 1,
      currency: 'INR',
      receipt: createShortReceipt(),
      notes: {
        doctor_id: userId,
        purpose: 'ai_message_recharge',
        package_id: recharge.packageId,
        subtotal: subtotal.toFixed(2),
        meta_fee: metaFee.toFixed(2),
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
      },
    });
  } catch (error) {
    console.error('[YogiDesk Secure Payments] Razorpay invoice creation failed', {
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      message: error?.message || 'Unknown invoice error',
      providerError: error?.error || error?.response?.data || null,
    });
    return null;
  }
};

const timingSafeEqualHex = (left, right) => {
  const safeLeft = Buffer.from(String(left || ''), 'utf8');
  const safeRight = Buffer.from(String(right || ''), 'utf8');
  return safeLeft.length === safeRight.length && crypto.timingSafeEqual(safeLeft, safeRight);
};

const createAiReceipt = () => `ai_${Date.now()}_${Math.floor(Math.random() * 100)}`.slice(0, 39);

const sha512 = (value) => crypto.createHash('sha512').update(value).digest('hex');
const getPayuCredentials = () => ({
  key: String(isPayuSandbox ? (process.env.PAYU_TEST_MERCHANT_KEY || PAYU_TEST_MERCHANT_KEY) : process.env.PAYU_MERCHANT_KEY).trim(),
  salt: String(isPayuSandbox ? (process.env.PAYU_TEST_MERCHANT_SALT || PAYU_TEST_MERCHANT_SALT) : process.env.PAYU_MERCHANT_SALT).trim(),
});

const normalizeAmount = (value) => {
  const amount = parseFloat(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : null;
};

const createShortReceipt = () => `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`.slice(0, 39);

const getRazorpayCredentials = () => ({
  keyId: String(process.env.RAZORPAY_KEY_ID || '').trim(),
  keySecret: String(process.env.RAZORPAY_KEY_SECRET || '').trim(),
});

const getBearerToken = (req) => {
  const header = String(req.headers.authorization || '').trim();
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

const resolveAuthenticatedDoctor = async (req) => {
  const token = getBearerToken(req);
  if (token) {
    if (token.startsWith('supabase-bypass-token-')) {
      const id = token.replace('supabase-bypass-token-', '').trim();
      if (id) return { id, email: req.body?.email || null };
    }

    const client = supabaseAdmin || supabase;
    if (client?.auth?.getUser) {
      const { data, error } = await client.auth.getUser(token);
      if (!error && data?.user?.id) return data.user;
    }
  }

  const fallbackId = String(req.user?.id || req.body?.userId || '').trim();
  return fallbackId ? { id: fallbackId, email: req.body?.email || null } : null;
};

const resolveTrueClinicForUser = async (userId) => {
  const safeUserId = String(userId || '').trim();
  if (!db?.from || !safeUserId) return null;

  try {
    const { data, error } = await db
      .from('clinics')
      .select('id,ai_message_balance,ai_token_balance,token_limit')
      .eq('user_id', safeUserId)
      .maybeSingle();

    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
};

const getRazorpayClient = () => {
  const { keyId, keySecret } = getRazorpayCredentials();
  if (!keyId || !keySecret) {
    const error = new Error('Razorpay credentials missing');
    error.code = 'RAZORPAY_CONFIG_MISSING';
    throw error;
  }
  return {
    keyId,
    client: new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    }),
  };
};

const logRazorpayOrderError = (error, context = {}) => {
  console.error('[YogiDesk Secure Payments] Razorpay order creation failed', {
    ...context,
    code: error?.code || null,
    statusCode: error?.statusCode || error?.status || null,
    message: error?.message || 'Unknown Razorpay order error',
    providerError: error?.error || error?.response?.data || null,
  });
};

const getRazorpayErrorMessage = (error) => (
  error?.error?.description ||
  error?.description ||
  error?.response?.data?.error?.description ||
  error?.response?.data?.description ||
  error?.message ||
  'Razorpay initialization failed'
);

const isSchemaCacheError = (error) => {
  const text = String(error?.message || error?.details || error || '').toLowerCase();
  return error?.code === 'PGRST204' || error?.code === 'PGRST205' || text.includes('schema cache') || text.includes('could not find') || text.includes('column');
};

const buildDoctorBillingFallback = (doctor = {}, body = {}) => {
  const metadata = doctor.user_metadata || {};
  return {
    name: metadata.full_name || metadata.name || body.doctorName || body.name || 'Doctor',
    email: doctor.email || body.email || '',
    phone: normalizeSharedInvoiceContact(metadata.phone || body.phone || body.contact || ''),
    clinic_name: metadata.clinic_name || metadata.clinicName || body.clinic_name || body.clinicName || '',
  };
};

const resolveSubscriptionRechargeFromOrder = async ({ client, orderId, fallbackPlanId = '' }) => {
  const order = await client.orders.fetch(orderId);
  const notes = order?.notes || {};
  const planId = String(notes.plan_id || fallbackPlanId || '').trim().toLowerCase();
  const verifiedPlan = SECURE_PLAN_CATALOG[planId] || null;
  const subtotal = Number(notes.subtotal || (verifiedPlan ? verifiedPlan.amountPaise / 100 : 0));
  const metaFee = Number(notes.meta_fee || calculateSharedMetaFee(subtotal));
  return {
    order,
    userId: String(notes.doctor_id || notes.userId || '').trim(),
    planId: verifiedPlan?.planId || planId,
    tier: notes.tier || verifiedPlan?.tier || '',
    packageLabel: notes.package_label || notes.planName || verifiedPlan?.label || 'YogiDesk Fixed Plan',
    subtotal,
    metaFee,
    totalAmount: Number(notes.total_amount || (subtotal + metaFee)),
    doctorName: notes.doctor_name || '',
    doctorEmail: notes.doctor_email || notes.email || '',
    doctorPhone: notes.doctor_phone || '',
    clinicName: notes.clinic_name || '',
  };
};

const resolveWalletRechargeFromOrder = async ({ order }) => {
  const notes = order?.notes || {};
  const subtotal = Number(notes.subtotal || notes.amount || 0);
  return {
    order,
    userId: String(notes.user_id || notes.doctor_id || '').trim(),
    subtotal,
    totalAmount: Number(notes.total_amount || subtotal),
    doctorName: notes.doctor_name || '',
    doctorEmail: notes.doctor_email || '',
    doctorPhone: notes.doctor_phone || '',
    clinicName: notes.clinic_name || '',
  };
};

const createFixedPlanInvoice = async ({ client, userId, plan, razorpayOrderId, razorpayPaymentId, fallbackDoctor = {} }) => (
  createRazorpayNativeInvoice({
    razorpay: client,
    db,
    supabaseAdmin,
    userId,
    rechargeType: 'FIXED_PLAN',
    principalAmount: plan.subtotal,
    calculatedLineItems: buildFixedPlanLineItems({
      packageName: plan.packageLabel,
      principalAmount: plan.subtotal,
    }),
    customerFallback: fallbackDoctor,
    notes: {
      purpose: 'subscription',
      plan_id: plan.planId,
      tier: plan.tier,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
    },
  })
);

const creditWalletRecharge = async ({ userId, amount }) => {
  let walletResult = await db
    .from('wallets')
    .select('balance,whatsapp_credit_balance,is_first_recharge,welcome_gift_active,current_plan,plan_tier,lifetime_contacts_count')
    .eq('user_id', userId)
    .maybeSingle();

  if (walletResult.error && isSchemaCacheError(walletResult.error)) {
    walletResult = await db
      .from('wallets')
      .select('balance,is_first_recharge,welcome_gift_active,current_plan,plan_tier,lifetime_contacts_count')
      .eq('user_id', userId)
      .maybeSingle();
  }

  if (walletResult.error) throw walletResult.error;

  const walletRow = walletResult.data;
  const currentBalance = Number(walletRow?.balance || 0);
  const currentWhatsappBalance = Number(walletRow?.whatsapp_credit_balance ?? currentBalance);
  const nextBalance = Number((currentBalance + amount).toFixed(2));
  const nextWhatsappCreditBalance = Number((currentWhatsappBalance + amount).toFixed(2));
  const payload = {
    user_id: userId,
    balance: nextBalance,
    whatsapp_credit_balance: nextWhatsappCreditBalance,
    is_first_recharge: false,
    welcome_gift_active: walletRow?.welcome_gift_active ?? false,
    current_plan: walletRow?.current_plan || 'starter',
    plan_tier: walletRow?.plan_tier || 'starter',
    lifetime_contacts_count: Number(walletRow?.lifetime_contacts_count || 0),
  };

  let { error: upsertError } = await db.from('wallets').upsert(payload, { onConflict: 'user_id' });
  if (upsertError && isSchemaCacheError(upsertError)) {
    const { whatsapp_credit_balance: _removed, ...fallbackPayload } = payload;
    const fallbackResult = await db.from('wallets').upsert(fallbackPayload, { onConflict: 'user_id' });
    upsertError = fallbackResult.error;
  }
  if (upsertError) throw upsertError;
  return { currentBalance, nextBalance, currentWhatsappBalance, nextWhatsappCreditBalance };
};

router.post('/create-order', async (req, res) => {
  try {
    const doctor = await resolveAuthenticatedDoctor(req);
    if (!doctor?.id) {
      return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
    }

    const planId = String(req.body?.planId || '').trim().toLowerCase();
    const verifiedPlan = SECURE_PLAN_CATALOG[planId];
    if (!verifiedPlan) {
      logRazorpayOrderError(new Error('Plan validation mismatch'), { doctorId: doctor.id, planId });
      return res.status(400).json({ success: false, message: 'Unable to initialize secure checkout for this plan.' });
    }

    const { keyId, client } = getRazorpayClient();
    const subtotal = Number((verifiedPlan.amountPaise / 100).toFixed(2));
    const metaFee = calculateSharedMetaFee(subtotal);
    const totalAmount = Number((subtotal + metaFee).toFixed(2));
    const billingFallback = buildDoctorBillingFallback(doctor, req.body);
    const order = await client.orders.create({
      amount: sharedToPaise(totalAmount),
      currency: 'INR',
      receipt: createShortReceipt(),
      notes: {
        doctor_id: doctor.id,
        plan_id: verifiedPlan.planId,
        tier: verifiedPlan.tier,
        purpose: 'subscription',
        recharge_type: 'FIXED_PLAN',
        package_label: verifiedPlan.label,
        subtotal: subtotal.toFixed(2),
        meta_fee: metaFee.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        clinic_name: billingFallback.clinic_name,
        doctor_name: billingFallback.name,
        doctor_email: billingFallback.email,
        doctor_phone: billingFallback.phone,
      },
    });

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      planId: verifiedPlan.planId,
      planName: verifiedPlan.label,
      subtotal,
      metaFee,
      totalAmount,
    });
  } catch (error) {
    logRazorpayOrderError(error, { planId: req.body?.planId || null });
    return res.status(400).json({ success: false, message: getRazorpayErrorMessage(error) });
  }
});

router.post('/razorpay-subscription-session', async (req, res) => {
  try {
    const doctor = await resolveAuthenticatedDoctor(req);
    if (!doctor?.id) return res.status(401).json({ success: false, msg: 'Authenticated doctor session is required.' });

    const planId = String(req.body?.planId || '').trim().toLowerCase();
    const verifiedPlan = SECURE_PLAN_CATALOG[planId];
    if (!verifiedPlan) {
      logRazorpayOrderError(new Error('Legacy plan validation mismatch'), { doctorId: doctor.id, planId });
      return res.status(400).json({ success: false, msg: 'Unable to initialize secure checkout for this plan.' });
    }

    const { keyId, client } = getRazorpayClient();
    const subtotal = Number((verifiedPlan.amountPaise / 100).toFixed(2));
    const metaFee = calculateSharedMetaFee(subtotal);
    const totalAmount = Number((subtotal + metaFee).toFixed(2));
    const billingFallback = buildDoctorBillingFallback(doctor, req.body);
    const order = await client.orders.create({
      amount: sharedToPaise(totalAmount),
      currency: 'INR',
      receipt: createShortReceipt(),
      notes: {
        userId: doctor.id,
        doctor_id: doctor.id,
        plan_id: verifiedPlan.planId,
        tier: verifiedPlan.tier,
        planName: verifiedPlan.label,
        package_label: verifiedPlan.label,
        email: billingFallback.email,
        purpose: 'subscription',
        recharge_type: 'FIXED_PLAN',
        subtotal: subtotal.toFixed(2),
        meta_fee: metaFee.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        clinic_name: billingFallback.clinic_name,
        doctor_name: billingFallback.name,
        doctor_email: billingFallback.email,
        doctor_phone: billingFallback.phone,
      },
    });

    return res.status(200).json({ success: true, key: keyId, order });
  } catch (error) {
    logRazorpayOrderError(error, { legacy: true, planId: req.body?.planId || null });
    return res.status(400).json({ success: false, msg: getRazorpayErrorMessage(error) });
  }
});

router.post('/verify-razorpay-subscription', async (req, res) => {
  try {
    const { keySecret } = getRazorpayCredentials();
    if (!keySecret) return res.status(500).json({ success: false, msg: 'Razorpay secret is not configured.' });

    const userId = String(req.body?.userId || '').trim();
    const tier = String(req.body?.tier || 'GROWTH').trim();
    const razorpayOrderId = String(req.body?.razorpay_order_id || '').trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
    const razorpaySignature = String(req.body?.razorpay_signature || '').trim();

    if (!userId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, msg: 'Missing Razorpay verification fields.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({ success: false, msg: 'Invalid Razorpay signature.' });
    }

    const { client } = getRazorpayClient();
    const plan = await resolveSubscriptionRechargeFromOrder({
      client,
      orderId: razorpayOrderId,
      fallbackPlanId: req.body?.planId,
    });
    const invoiceUserId = plan.userId || userId;
    const paymentReference = `${razorpayOrderId}:${razorpayPaymentId}`;
    const profile = await activateSubscriptionTier({ db, userId, tier, paymentReference });
    const invoice = await createFixedPlanInvoice({
      client,
      userId: invoiceUserId,
      plan,
      razorpayOrderId,
      razorpayPaymentId,
      fallbackDoctor: {
        name: plan.doctorName || req.body?.doctorName || req.body?.name,
        email: plan.doctorEmail || req.body?.email,
        phone: plan.doctorPhone || req.body?.phone,
        clinic_name: plan.clinicName || req.body?.clinic_name || req.body?.clinicName,
      },
    });

    await db.from('wallet_transactions').insert([{
      user_id: userId,
      amount: Number(plan.subtotal || req.body?.amount || 0),
      transaction_type: 'SUBSCRIPTION',
      description: `Razorpay subscription activation successful: ${razorpayPaymentId}`,
      metadata: {
        provider: 'razorpay',
        purpose: 'subscription',
        recharge_type: 'FIXED_PLAN',
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_invoice_id: invoice?.id || null,
        razorpay_invoice_short_url: invoice?.short_url || null,
        plan_id: plan.planId,
        plan_name: plan.packageLabel,
        subtotal: plan.subtotal,
        meta_fee: plan.metaFee,
        total_amount: plan.totalAmount,
        tier,
      },
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('Razorpay subscription transaction log failed:', error.message || error);
    });

    return res.status(200).json({ success: true, profile });
  } catch (error) {
    console.error('Razorpay subscription verification failed:', error.message || error);
    return res.status(500).json({ success: false, msg: 'Unable to verify Razorpay subscription payment.' });
  }
});

router.post('/create-ai-order', async (req, res) => {
  try {
    const doctor = await resolveAuthenticatedDoctor(req);
    if (!doctor?.id) {
      return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
    }

    const packageId = String(req.body?.packageId || '').trim().toLowerCase();
    const customAmount = Number(req.body?.amount || 0);
    const exactAmountPackage = packageId === 'custom' ? AI_FIXED_SLAB_BY_AMOUNT[customAmount] || null : null;
    const selectedPackage = AI_MESSAGE_SLABS[packageId] || exactAmountPackage;
    const amount = selectedPackage ? selectedPackage.amount : customAmount;
    const messages = selectedPackage ? selectedPackage.messages : calculateAiMessagesForAmount(amount);
    const label = selectedPackage ? selectedPackage.label : 'Custom AI Messages';

    if (
      !Number.isFinite(amount)
      || amount < AI_CUSTOM_MIN_AMOUNT
      || (!selectedPackage && amount > AI_CUSTOM_MAX_AMOUNT)
      || messages <= 0
    ) {
      return res.status(400).json({ success: false, message: 'Custom recharge amount must be between ₹100 and ₹1,999.' });
    }

    const { keyId, client } = getRazorpayClient();
    const metaFee = calculateMetaFee(amount);
    const totalAmount = Number((amount + metaFee).toFixed(2));
    const amountPaise = Math.round(totalAmount * 100);
    const receipt = createAiReceipt();
    const doctorMetadata = doctor.user_metadata || {};
    const doctorName = doctorMetadata.full_name || doctorMetadata.name || req.body?.doctorName || req.body?.name || 'Doctor';
    const doctorEmail = doctor.email || req.body?.email || '';
    const doctorPhone = normalizeInvoiceContact(doctorMetadata.phone || req.body?.phone || req.body?.contact || '');
    const clinicName = doctorMetadata.clinic_name || doctorMetadata.clinicName || req.body?.clinic_name || req.body?.clinicName || doctorName;

    const order = await client.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        doctor_id: doctor.id,
        purpose: 'ai_message_recharge',
        package_id: selectedPackage?.packageId || 'custom',
        package_label: label,
        messages: String(messages),
        amount: amount.toFixed(2),
        subtotal: amount.toFixed(2),
        meta_fee: metaFee.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        doctor_name: doctorName,
        doctor_email: doctorEmail,
        doctor_phone: doctorPhone,
        clinic_name: clinicName,
      },
    });

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      receipt,
      packageId: selectedPackage?.packageId || 'custom',
      packageName: label,
      aiMessages: messages,
      rupeeAmount: amount,
      subtotal: amount,
      metaFee,
      totalAmount,
    });
  } catch (error) {
    logRazorpayOrderError(error, { purpose: 'ai_message_recharge', packageId: req.body?.packageId || null });
    return res.status(400).json({ success: false, message: getRazorpayErrorMessage(error) });
  }
});

const insertAiPassbookCredit = async ({
  userId,
  amount,
  messages,
  packageId,
  razorpayOrderId,
  razorpayPaymentId,
  previousBalance,
  nextBalance,
  invoice = null,
  source = 'razorpay'
}) => {
  if (!db?.from || !userId) return;
  try {
    const { error } = await db.from('wallet_passbook').insert([{
      user_id: userId,
      doctor_id: userId,
      patient_number: 'RECHARGE_CREDIT',
      entry_type: 'AI_MESSAGE_CREDIT',
      amount: Number(amount || 0),
      messages_delta: Number(messages || 0),
      description: `AI Assistant Recharge: +${Number(messages || 0).toLocaleString('en-IN')} Messages Added`,
      metadata: {
        provider: source,
        purpose: 'ai_message_recharge',
        activity_tag: 'RECHARGE_CREDIT',
        package_id: packageId,
        ai_messages: Number(messages || 0),
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_tracking_tag: `RAZORPAY:${razorpayPaymentId || 'VERIFIED'}`,
        razorpay_invoice_id: invoice?.id || null,
        razorpay_invoice_short_url: invoice?.short_url || null,
        previous_ai_message_balance: previousBalance,
        next_ai_message_balance: nextBalance,
      },
      created_at: new Date().toISOString(),
    }]);
    if (error && !String(error.message || '').toLowerCase().includes('schema cache')) {
      console.error('AI message passbook credit log failed:', error.message || error);
    }
  } catch (error) {
    console.warn('AI message passbook credit log skipped:', error.message || error);
  }
};

const resolveAiRechargeFromOrder = async ({ client, orderId, fallbackPackageId = 'custom', fallbackAmount = 0 }) => {
  const order = await client.orders.fetch(orderId);
  const notes = order?.notes || {};
  const packageId = String(notes.package_id || fallbackPackageId || 'custom').trim().toLowerCase();
  const selectedPackage = AI_MESSAGE_SLABS[packageId] || null;
  const subtotal = selectedPackage ? selectedPackage.amount : Number(notes.subtotal || notes.amount || fallbackAmount || 0);
  const aiMessages = selectedPackage ? selectedPackage.messages : calculateAiMessagesForAmount(subtotal);
  const metaFee = Number(notes.meta_fee || calculateMetaFee(subtotal));
  const totalAmount = Number(notes.total_amount || (subtotal + metaFee));
  return {
    order,
    userId: String(notes.doctor_id || notes.user_id || '').trim(),
    packageId: selectedPackage?.packageId || 'custom',
    packageLabel: notes.package_label || selectedPackage?.label || 'Custom AI Messages',
    subtotal,
    metaFee,
    totalAmount,
    aiMessages,
    doctorName: notes.doctor_name || '',
    doctorEmail: notes.doctor_email || '',
    doctorPhone: notes.doctor_phone || '',
    clinicName: notes.clinic_name || '',
  };
};

const creditAiMessagesAtomically = async ({ userId, aiMessages, usage = {} }) => {
  const clinicRow = await resolveTrueClinicForUser(userId);
  const currentClinicBalance = Number(clinicRow?.ai_message_balance ?? clinicRow?.ai_token_balance ?? clinicRow?.token_limit ?? 0);
  let profileTable = 'doctor_profiles';
  let { data: profileRow, error: profileError } = await db
    .from('doctor_profiles')
    .select('id,ai_message_balance,ai_token_balance,token_limit')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profileRow?.id) {
    const fallbackProfile = await db
      .from('profiles')
      .select('id,ai_message_balance,ai_token_balance,token_limit')
      .eq('id', userId)
      .maybeSingle();
    if (!fallbackProfile.error && fallbackProfile.data?.id) {
      profileTable = 'profiles';
      profileRow = fallbackProfile.data;
    }
  }

  const currentBalance = Number(profileRow?.ai_message_balance ?? profileRow?.ai_token_balance ?? profileRow?.token_limit ?? 0);
  const balanceSource = clinicRow?.id ? currentClinicBalance : currentBalance;
  const nextBalance = balanceSource + aiMessages;
  let update = { error: null, data: null };
  if (db.rpc) {
    update = await db.rpc('credit_ai_message_balance', {
      p_messages: aiMessages,
      p_usage: 0,
      p_user_id: userId
    });
  }

  if (update.error) {
    console.warn('AI message RPC credit unavailable, falling back to profile update:', update.error.message || update.error);
    update = await db
      .from(profileTable)
      .update({ ai_message_balance: nextBalance })
      .eq('id', userId);
  }

  if (update.error && String(update.error.message || '').toLowerCase().includes('column')) {
    update = await db
      .from(profileTable)
      .update({ ai_token_balance: nextBalance, token_limit: nextBalance })
      .eq('id', userId);
  }

  if (update.error) throw update.error;

  if (clinicRow?.id) {
    const clinicNextBalance = currentClinicBalance + aiMessages;
    const { error: clinicUpdateError } = await db
      .from('clinics')
      .update({ ai_message_balance: clinicNextBalance })
      .eq('id', clinicRow.id);
    if (clinicUpdateError && !String(clinicUpdateError.message || '').toLowerCase().includes('schema cache')) {
      console.error('AI message clinic recharge balance sync failed:', clinicUpdateError.message || clinicUpdateError);
    }
    return { currentBalance: currentClinicBalance, nextBalance: clinicNextBalance };
  }

  return { currentBalance, nextBalance };
};

router.post('/verify-ai-payment', async (req, res) => {
  try {
    const { keySecret } = getRazorpayCredentials();
    if (!keySecret) return res.status(500).json({ success: false, message: 'Razorpay secret is not configured.' });

    const doctor = await resolveAuthenticatedDoctor(req);
    const { client } = getRazorpayClient();
    const razorpayOrderId = String(req.body?.razorpay_order_id || '').trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
    const razorpaySignature = String(req.body?.razorpay_signature || '').trim();

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay verification fields.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (!timingSafeEqualHex(expectedSignature, razorpaySignature)) {
      return res.status(400).json({ success: false, message: 'Invalid Razorpay signature.' });
    }

    const recharge = await resolveAiRechargeFromOrder({
      client,
      orderId: razorpayOrderId,
      fallbackPackageId: req.body?.packageId,
      fallbackAmount: req.body?.amount,
    });
    const userId = recharge.userId || String(doctor?.id || req.body?.userId || '').trim();
    const amount = Number(recharge.subtotal || 0);
    const aiMessages = Number(recharge.aiMessages || 0);
    const packageId = recharge.packageId;

    if (!userId || !Number.isFinite(amount) || amount < AI_CUSTOM_MIN_AMOUNT || !Number.isFinite(aiMessages) || aiMessages <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid AI message recharge details.' });
    }
    if (doctor?.id && doctor.id !== userId) {
      return res.status(403).json({ success: false, message: 'Payment order does not belong to this doctor session.' });
    }

    const { data: existingTransaction, error: existingTransactionError } = await db
      .from('wallet_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>razorpay_payment_id', razorpayPaymentId)
      .maybeSingle();

    if (existingTransactionError) {
      console.error('AI message duplicate transaction check failed:', existingTransactionError.message || existingTransactionError);
    }
    if (existingTransaction?.id) {
      return res.status(200).json({ success: true, message: 'Payment already processed.' });
    }

    const { currentBalance, nextBalance } = await creditAiMessagesAtomically({
      userId,
      aiMessages,
      usage: { provider: 'razorpay', package_id: packageId, charged_at: new Date().toISOString() }
    });
    const customInvoice = await sendAiCreditInvoiceEmail({
      db,
      supabaseAdmin,
      userId,
      recharge,
      razorpayPaymentId,
      paidAt: new Date(),
      fallbackDoctor: {
        name: recharge.doctorName || doctor?.user_metadata?.full_name || doctor?.user_metadata?.name,
        doctorName: recharge.doctorName || doctor?.user_metadata?.full_name || doctor?.user_metadata?.name,
        email: recharge.doctorEmail || doctor?.email,
        phone: recharge.doctorPhone || doctor?.user_metadata?.phone,
        clinicName: recharge.clinicName || doctor?.user_metadata?.clinic_name || doctor?.user_metadata?.clinicName,
      },
    });
    const invoice = await createRazorpayAiInvoice({
      client,
      userId,
      recharge,
      razorpayOrderId,
      razorpayPaymentId,
      fallbackDoctor: {
        name: recharge.doctorName || doctor?.user_metadata?.full_name || doctor?.user_metadata?.name,
        email: recharge.doctorEmail || doctor?.email,
        phone: recharge.doctorPhone || doctor?.user_metadata?.phone,
      },
    });

    await db.from('wallet_transactions').insert([{
      user_id: userId,
      amount,
      transaction_type: 'AI_MESSAGE_CREDIT',
      description: `Razorpay AI message credits topup successful: ${razorpayPaymentId}`,
      metadata: {
        provider: 'razorpay',
        purpose: 'ai_message_recharge',
        package_id: packageId,
        ai_messages: aiMessages,
        meta_fee: recharge.metaFee,
        total_amount: recharge.totalAmount,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_invoice_id: invoice?.id || null,
        razorpay_invoice_short_url: invoice?.short_url || null,
        custom_invoice_number: customInvoice.invoiceNumber,
        custom_invoice_email_sent: Boolean(customInvoice.sent),
        previous_ai_message_balance: currentBalance,
        next_ai_message_balance: nextBalance,
      },
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('AI message transaction log failed:', error.message || error);
    });

    await insertAiPassbookCredit({
      userId,
      amount,
      messages: aiMessages,
      packageId,
      razorpayOrderId,
      razorpayPaymentId,
      previousBalance: currentBalance,
      nextBalance,
      invoice,
    });

    return res.status(200).json({
      success: true,
      message: 'AI message credits added successfully.',
      aiMessageBalance: nextBalance,
      aiMessages,
    });
  } catch (error) {
    console.error('Razorpay AI message verification failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to verify AI message payment.' });
  }
});

router.post('/razorpay-webhook', async (req, res) => {
  try {
    const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
    const incomingSignature = String(req.get('x-razorpay-signature') || '').trim();

    if (!webhookSecret || !incomingSignature || !rawBody) {
      return res.status(400).json({ success: false, message: 'Razorpay webhook signature configuration missing.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!timingSafeEqualHex(expectedSignature, incomingSignature)) {
      return res.status(400).json({ success: false, message: 'Invalid Razorpay webhook signature.' });
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payment = event?.payload?.payment?.entity;
    const orderId = String(payment?.order_id || '').trim();
    const paymentId = String(payment?.id || '').trim();

    if (event?.event !== 'payment.captured' || !orderId || !paymentId) {
      return res.status(200).json({ success: true, skipped: true });
    }

    const { client } = getRazorpayClient();
    const capturedOrder = await client.orders.fetch(orderId);
    const capturedNotes = capturedOrder?.notes || {};
    const capturedPurpose = String(payment?.notes?.purpose || capturedNotes.purpose || '').trim();
    const capturedRechargeType = String(payment?.notes?.recharge_type || capturedNotes.recharge_type || '').trim();

    if (capturedPurpose === 'subscription' || capturedRechargeType === 'FIXED_PLAN') {
      const plan = await resolveSubscriptionRechargeFromOrder({ client, orderId });
      const userId = plan.userId || String(payment?.notes?.doctor_id || payment?.notes?.userId || payment?.notes?.user_id || '').trim();
      if (!userId || !plan.planId || !Number.isFinite(Number(plan.subtotal)) || Number(plan.subtotal) <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid subscription webhook payload.' });
      }

      const { data: existingTransaction, error: existingTransactionError } = await db
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>razorpay_payment_id', paymentId)
        .maybeSingle();

      if (existingTransactionError) console.error('Subscription webhook duplicate check failed:', existingTransactionError.message || existingTransactionError);
      if (existingTransaction?.id) return res.status(200).json({ success: true, message: 'Payment already processed.' });

      const paymentReference = `${orderId}:${paymentId}`;
      await activateSubscriptionTier({ db, userId, tier: plan.tier || payment?.notes?.tier || 'GROWTH', paymentReference });
      const invoice = await createFixedPlanInvoice({
        client,
        userId,
        plan,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        fallbackDoctor: {
          name: plan.doctorName || payment?.notes?.doctor_name,
          email: plan.doctorEmail || payment?.email || payment?.notes?.doctor_email,
          phone: plan.doctorPhone || payment?.contact || payment?.notes?.doctor_phone,
          clinic_name: plan.clinicName || payment?.notes?.clinic_name,
        },
      });

      await db.from('wallet_transactions').insert([{
        user_id: userId,
        amount: Number(plan.subtotal || 0),
        transaction_type: 'SUBSCRIPTION',
        description: `Razorpay subscription activation successful: ${paymentId}`,
        metadata: {
          provider: 'razorpay',
          purpose: 'subscription',
          recharge_type: 'FIXED_PLAN',
          plan_id: plan.planId,
          plan_name: plan.packageLabel,
          tier: plan.tier,
          subtotal: plan.subtotal,
          meta_fee: plan.metaFee,
          total_amount: plan.totalAmount,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_invoice_id: invoice?.id || null,
          razorpay_invoice_short_url: invoice?.short_url || null,
          webhook_event: event.event,
        },
        created_at: new Date().toISOString(),
      }]);

      return res.status(200).json({ success: true });
    }

    if (capturedPurpose === 'wallet_recharge' || capturedRechargeType === 'RAW_WHATSAPP_CREDITS') {
      const recharge = await resolveWalletRechargeFromOrder({ order: capturedOrder });
      const userId = recharge.userId || String(payment?.notes?.user_id || payment?.notes?.doctor_id || '').trim();
      const amount = Number(recharge.subtotal || 0);
      if (!userId || !Number.isFinite(amount) || amount < 10) {
        return res.status(400).json({ success: false, message: 'Invalid wallet recharge webhook payload.' });
      }

      const { data: existingTransaction, error: existingTransactionError } = await db
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>razorpay_payment_id', paymentId)
        .maybeSingle();

      if (existingTransactionError) console.error('Wallet webhook duplicate check failed:', existingTransactionError.message || existingTransactionError);
      if (existingTransaction?.id) return res.status(200).json({ success: true, message: 'Payment already processed.' });

      const { currentBalance, nextBalance, currentWhatsappBalance, nextWhatsappCreditBalance } = await creditWalletRecharge({ userId, amount });

      await db.from('wallet_transactions').insert([{
        user_id: userId,
        amount,
        transaction_type: 'CREDIT',
        description: `Razorpay wallet recharge successful: ${paymentId}`,
        metadata: {
          provider: 'razorpay',
          purpose: 'wallet_recharge',
          recharge_type: 'RAW_WHATSAPP_CREDITS',
          subtotal: recharge.subtotal,
          total_amount: recharge.totalAmount,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          webhook_event: event.event,
          previous_balance: currentBalance,
          next_balance: nextBalance,
          previous_whatsapp_credit_balance: currentWhatsappBalance,
          next_whatsapp_credit_balance: nextWhatsappCreditBalance,
        },
        created_at: new Date().toISOString(),
      }]);

      return res.status(200).json({ success: true });
    }

    const recharge = await resolveAiRechargeFromOrder({ client, orderId });
    if (payment?.notes?.purpose !== 'ai_message_recharge' && recharge.order?.notes?.purpose !== 'ai_message_recharge') {
      return res.status(200).json({ success: true, skipped: true });
    }

    const userId = recharge.userId || String(payment?.notes?.doctor_id || payment?.notes?.user_id || '').trim();
    const amount = Number(recharge.subtotal || 0);
    const aiMessages = Number(recharge.aiMessages || 0);
    if (!userId || !Number.isFinite(amount) || amount < AI_CUSTOM_MIN_AMOUNT || aiMessages <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid AI recharge webhook payload.' });
    }

    const { data: existingTransaction, error: existingTransactionError } = await db
      .from('wallet_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>razorpay_payment_id', paymentId)
      .maybeSingle();

    if (existingTransactionError) console.error('AI webhook duplicate check failed:', existingTransactionError.message || existingTransactionError);
    if (existingTransaction?.id) return res.status(200).json({ success: true, message: 'Payment already processed.' });

    const { currentBalance, nextBalance } = await creditAiMessagesAtomically({
      userId,
      aiMessages,
      usage: { provider: 'razorpay_webhook', package_id: recharge.packageId, charged_at: new Date().toISOString() }
    });
    const customInvoice = await sendAiCreditInvoiceEmail({
      db,
      supabaseAdmin,
      userId,
      recharge,
      razorpayPaymentId: paymentId,
      paidAt: payment?.created_at ? new Date(Number(payment.created_at) * 1000) : new Date(),
      fallbackDoctor: {
        name: recharge.doctorName || payment?.notes?.doctor_name,
        doctorName: recharge.doctorName || payment?.notes?.doctor_name,
        email: recharge.doctorEmail || payment?.email || payment?.notes?.doctor_email,
        phone: recharge.doctorPhone || payment?.contact || payment?.notes?.doctor_phone,
        clinicName: recharge.clinicName || payment?.notes?.clinic_name,
      },
    });
    const invoice = await createRazorpayAiInvoice({
      client,
      userId,
      recharge,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      fallbackDoctor: {
        name: recharge.doctorName || payment?.notes?.doctor_name,
        email: recharge.doctorEmail || payment?.email || payment?.notes?.doctor_email,
        phone: recharge.doctorPhone || payment?.contact || payment?.notes?.doctor_phone,
      },
    });

    await db.from('wallet_transactions').insert([{
      user_id: userId,
      amount,
      transaction_type: 'AI_MESSAGE_CREDIT',
      description: `Razorpay AI message credits topup successful: ${paymentId}`,
      metadata: {
        provider: 'razorpay',
        purpose: 'ai_message_recharge',
        package_id: recharge.packageId,
        ai_messages: aiMessages,
        meta_fee: recharge.metaFee,
        total_amount: recharge.totalAmount,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_invoice_id: invoice?.id || null,
        razorpay_invoice_short_url: invoice?.short_url || null,
        custom_invoice_number: customInvoice.invoiceNumber,
        custom_invoice_email_sent: Boolean(customInvoice.sent),
        webhook_event: event.event,
        previous_ai_message_balance: currentBalance,
        next_ai_message_balance: nextBalance,
      },
      created_at: new Date().toISOString(),
    }]);

    await insertAiPassbookCredit({
      userId,
      amount,
      messages: aiMessages,
      packageId: recharge.packageId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      previousBalance: currentBalance,
      nextBalance,
      invoice,
      source: 'razorpay_webhook',
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Razorpay webhook processing failed:', error.message || error);
    return res.status(500).json({ success: false, message: 'Unable to process Razorpay webhook.' });
  }
});

router.post('/initiate-payu', async (req, res) => {
  try {
    const { key, salt } = getPayuCredentials();
    if (!key || !salt) {
      return res.status(500).json({ success: false, message: 'Server configuration missing Merchant Key or Salt.' });
    }

    const userId = String(req.body?.userId || '').trim();
    const formattedAmount = normalizeAmount(req.body?.amount);
    const firstname = String(req.body?.firstname || 'Yogi Desk User').trim();
    const email = String(req.body?.email || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const udf1 = String(req.body?.purpose || '').trim();
    const udf2 = String(req.body?.tier || '').trim();
    const udf3 = '';
    const udf4 = '';
    const udf5 = '';

    if (!userId) return res.status(400).json({ success: false, msg: 'User ID is required.' });
    if (!formattedAmount || Number(formattedAmount) < 10) return res.status(400).json({ success: false, msg: 'Minimum recharge amount is Rs. 10.' });
    if (!email) return res.status(400).json({ success: false, msg: 'Email is required for PayU checkout.' });

    const txnid = `TXN_${Date.now()}`;
    const productinfo = userId;
    const surl = `${API_BASE_URL}/api/payments/payu-success`;
    const furl = `${API_BASE_URL}/api/payments/payu-failure`;
    const hashString = `${key}|${txnid}|${formattedAmount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
    const hash = sha512(hashString);

    return res.status(200).json({
      success: true,
      checkoutUrl: PAYU_CHECKOUT_URL,
      payload: {
        key,
        txnid,
        amount: formattedAmount,
        productinfo,
        firstname,
        email,
        phone,
        udf1,
        udf2,
        udf3,
        udf4,
        udf5,
        surl,
        furl,
        hash,
      },
    });
  } catch (error) {
    console.error('PayU initiate error:', error.message || error);
    return res.status(500).json({ success: false, msg: 'Unable to initiate PayU checkout.' });
  }
});

router.post('/payu-success', async (req, res) => {
  try {
    const { key, salt } = getPayuCredentials();
    if (!key || !salt) return res.status(500).send('PayU credentials are not configured.');

    const status = String(req.body?.status || '').trim();
    const txnid = String(req.body?.txnid || '').trim();
    const amount = String(req.body?.amount || '').trim();
    const firstname = String(req.body?.firstname || '').trim();
    const email = String(req.body?.email || '').trim();
    const productinfo = String(req.body?.productinfo || '').trim();
    const udf1 = String(req.body?.udf1 || '').trim();
    const udf2 = String(req.body?.udf2 || '').trim();
    const udf3 = String(req.body?.udf3 || '').trim();
    const udf4 = String(req.body?.udf4 || '').trim();
    const udf5 = String(req.body?.udf5 || '').trim();
    const incomingHash = String(req.body?.hash || '').trim();
    const userId = productinfo;

    const reverseHashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    const calculatedHash = sha512(reverseHashString);

    if (!incomingHash || calculatedHash !== incomingHash) {
      console.error('PayU hash mismatch:', { txnid, userId, status });
      return res.status(400).send('Invalid PayU signature.');
    }

    if (status !== 'success') {
      return res.redirect(`${FRONTEND_WALLET_URL}?payment=failed`);
    }

    if (!db?.from || !userId) {
      return res.redirect(`${FRONTEND_WALLET_URL}?payment=failed`);
    }

    const paidAmount = Number(amount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return res.redirect(`${FRONTEND_WALLET_URL}?payment=failed`);
    }

    const { data: existingTransaction, error: existingTransactionError } = await db
      .from('wallet_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>txnid', txnid)
      .maybeSingle();

    if (existingTransactionError) {
      console.error('PayU duplicate transaction check failed:', existingTransactionError.message || existingTransactionError);
    }
    if (existingTransaction?.id) {
      return res.redirect(`${FRONTEND_WALLET_URL}?payment=success&amt=${encodeURIComponent(amount)}`);
    }

    if (udf1 === 'subscription') {
      await activateSubscriptionTier({ db, userId, tier: udf2 || 'GROWTH', paymentReference: txnid });
      await db.from('wallet_transactions').insert([{
        user_id: userId,
        amount: paidAmount,
        transaction_type: 'SUBSCRIPTION',
        description: `PayU subscription activation successful: ${txnid}`,
        metadata: {
          provider: 'payu',
          txnid,
          email,
          firstname,
          tier: udf2 || 'GROWTH',
        },
        created_at: new Date().toISOString(),
      }]).then(({ error }) => {
        if (error) console.error('PayU subscription transaction log failed:', error.message || error);
      });
      return res.redirect(`${FRONTEND_PRICING_URL}?subscription=success&tier=${encodeURIComponent(udf2 || 'GROWTH')}`);
    }

    const { data: walletRow, error: walletError } = await db
      .from('wallets')
      .select('balance,is_first_recharge,welcome_gift_active,current_plan,plan_tier,lifetime_contacts_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError) throw walletError;

    const currentBalance = Number(walletRow?.balance || 0);
    const nextBalance = Number((currentBalance + paidAmount).toFixed(2));

    const { error: upsertError } = await db.from('wallets').upsert({
      user_id: userId,
      balance: nextBalance,
      is_first_recharge: false,
      welcome_gift_active: walletRow?.welcome_gift_active ?? false,
      current_plan: walletRow?.current_plan || 'starter',
      plan_tier: walletRow?.plan_tier || 'starter',
      lifetime_contacts_count: Number(walletRow?.lifetime_contacts_count || 0),
    }, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    await db.from('wallet_transactions').insert([{
      user_id: userId,
      amount: paidAmount,
      transaction_type: 'CREDIT',
      description: `PayU wallet recharge successful: ${txnid}`,
      metadata: {
        provider: 'payu',
        txnid,
        email,
        firstname,
        previous_balance: currentBalance,
        next_balance: nextBalance,
      },
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('PayU transaction log failed:', error.message || error);
    });

    return res.redirect(`${FRONTEND_WALLET_URL}?payment=success&amt=${encodeURIComponent(amount)}`);
  } catch (error) {
    console.error('PayU success handler error:', error.message || error);
    return res.redirect(`${FRONTEND_WALLET_URL}?payment=failed`);
  }
});

router.post('/payu-failure', (req, res) => {
  const amount = req.body?.amount ? `&amt=${encodeURIComponent(req.body.amount)}` : '';
  return res.redirect(`${FRONTEND_WALLET_URL}?payment=failed${amount}`);
});

// ============================================================================
// WALLET RECHARGE ENDPOINTS (RAZORPAY)
// ============================================================================

// POST /api/payments/wallet/create-order
// Creates a Razorpay order for wallet recharge
router.post('/wallet/create-order', createWalletOrder);

// POST /api/payments/wallet/verify-payment
// Verifies the Razorpay payment and credits the wallet
router.post('/wallet/verify-payment', verifyWalletPayment);

module.exports = router;
