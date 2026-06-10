const crypto = require('crypto');
const Razorpay = require('razorpay');
const { supabaseAdmin, supabase } = require('../config/supabase');

const db = supabaseAdmin || supabase;

const getRazorpayCredentials = () => ({
  keyId: String(process.env.RAZORPAY_KEY_ID || '').trim(),
  keySecret: String(process.env.RAZORPAY_KEY_SECRET || '').trim(),
});

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

const createWalletReceipt = () => `wlt_${Date.now()}_${Math.floor(Math.random() * 100)}`;

const parseWalletAmount = (value) => {
  const amount = Number.parseFloat(value);
  return Number.isFinite(amount) ? amount : null;
};

const createWalletOrder = async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const amount = parseWalletAmount(req.body?.amount);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required.',
      });
    }

    if (!Number.isFinite(amount) || amount < 10) {
      return res.status(400).json({
        success: false,
        message: 'Minimum wallet recharge amount is Rs. 10.',
      });
    }

    const { keyId, client } = getRazorpayClient();
    const amountInPaise = Math.round(amount * 100);
    const walletReceipt = createWalletReceipt();

    const order = await client.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: walletReceipt,
      notes: {
        user_id: userId,
        purpose: 'wallet_recharge',
        amount: amount.toFixed(2),
      },
    });

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      receipt: walletReceipt,
    });
  } catch (error) {
    console.error('[YogiDesk Wallet] Razorpay order creation failed:', {
      code: error?.code,
      statusCode: error?.statusCode || error?.status,
      message: error?.message,
      providerError: error?.error || error?.response?.data || null,
    });

    const errorMessage = error?.error?.description || error?.message || 'Failed to initialize wallet recharge';
    return res.status(400).json({
      success: false,
      message: errorMessage,
    });
  }
};

const verifyWalletPayment = async (req, res) => {
  try {
    const { keySecret } = getRazorpayCredentials();
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message: 'Razorpay secret is not configured.',
      });
    }

    const userId = String(req.body?.userId || '').trim();
    const amount = parseWalletAmount(req.body?.amount);
    const razorpayOrderId = String(req.body?.razorpay_order_id || '').trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
    const razorpaySignature = String(req.body?.razorpay_signature || '').trim();

    if (!userId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification fields.',
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment amount.',
      });
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      console.error('[YogiDesk Wallet] Razorpay signature mismatch:', {
        userId,
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature.',
      });
    }

    const { data: existingTransaction, error: checkError } = await db
      .from('wallet_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>razorpay_payment_id', razorpayPaymentId)
      .maybeSingle();

    if (checkError) {
      console.error('[YogiDesk Wallet] Duplicate check error:', checkError.message || checkError);
    }

    if (existingTransaction?.id) {
      return res.status(200).json({
        success: true,
        message: 'Payment already processed.',
      });
    }

    const { data: walletRow, error: walletError } = await db
      .from('wallets')
      .select('balance,is_first_recharge,welcome_gift_active,current_plan,plan_tier,lifetime_contacts_count')
      .eq('user_id', userId)
      .maybeSingle();

    if (walletError) throw walletError;

    const currentBalance = Number(walletRow?.balance || 0);
    const newBalance = Number((currentBalance + amount).toFixed(2));

    const { error: upsertError } = await db.from('wallets').upsert({
      user_id: userId,
      balance: newBalance,
      is_first_recharge: false,
      welcome_gift_active: walletRow?.welcome_gift_active ?? false,
      current_plan: walletRow?.current_plan || 'starter',
      plan_tier: walletRow?.plan_tier || 'starter',
      lifetime_contacts_count: Number(walletRow?.lifetime_contacts_count || 0),
    }, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    await db.from('wallet_transactions').insert([{
      user_id: userId,
      amount,
      transaction_type: 'CREDIT',
      description: `Razorpay wallet recharge successful: ${razorpayPaymentId}`,
      metadata: {
        provider: 'razorpay',
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        previous_balance: currentBalance,
        next_balance: newBalance,
      },
      created_at: new Date().toISOString(),
    }]).then(({ error }) => {
      if (error) console.error('[YogiDesk Wallet] Transaction log failed:', error.message || error);
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified and wallet credited successfully.',
      newBalance,
      amount,
    });
  } catch (error) {
    console.error('[YogiDesk Wallet] Payment verification error:', error.message || error);
    return res.status(500).json({
      success: false,
      message: 'Unable to verify wallet payment. Please contact support.',
    });
  }
};

module.exports = {
  createWalletOrder,
  verifyWalletPayment,
};
