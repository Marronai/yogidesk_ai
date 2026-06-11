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

const maskTokenText = (value) => String(value || '').replace(/\bTokens?\b/gi, 'Messages');

const sanitizePassbookRowForUi = (row = {}) => ({
  id: row.id,
  user_id: row.user_id,
  amount: Number(row.amount || 0),
  transaction_type: row.entry_type || row.transaction_type,
  type: row.entry_type || row.transaction_type,
  description: maskTokenText(row.description),
  metadata: {
    purpose: row.metadata?.purpose || (String(row.entry_type || '').includes('AI_MESSAGE') ? 'ai_message_recharge' : undefined),
    package_id: row.metadata?.package_id,
    ai_messages: row.metadata?.ai_messages ?? Math.abs(Number(row.messages_delta || 0)),
    messages_delta: row.messages_delta,
    razorpay_payment_id: row.metadata?.razorpay_payment_id,
    razorpay_order_id: row.metadata?.razorpay_order_id,
    meta_fee: row.metadata?.meta_fee,
    total_amount: row.metadata?.total_amount,
  },
  created_at: row.created_at,
});

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

const getWalletTransactions = async (req, res) => {
  try {
    const userId = String(req.query?.userId || req.body?.userId || '').trim();
    const purpose = String(req.query?.purpose || '').trim();

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required.',
      });
    }

    if (purpose === 'ai_message_recharge') {
      const [transactionResult, passbookResult] = await Promise.all([
        db
          .from('wallet_transactions')
          .select('id,user_id,amount,transaction_type,description,metadata,created_at')
          .eq('user_id', userId)
          .eq('transaction_type', 'AI_MESSAGE_CREDIT')
          .order('created_at', { ascending: false }),
        db
          .from('wallet_passbook')
          .select('id,user_id,doctor_id,patient_number,entry_type,amount,messages_delta,description,metadata,created_at')
          .eq('user_id', userId)
          .like('entry_type', 'AI_MESSAGE%')
          .order('created_at', { ascending: false }),
      ]);

      if (transactionResult.error) throw transactionResult.error;
      const passbookErrorText = String(passbookResult.error?.message || passbookResult.error?.details || '').toLowerCase();
      const passbookMissing = passbookResult.error?.code === 'PGRST205' || passbookResult.error?.code === 'PGRST204' || passbookErrorText.includes('schema cache') || passbookErrorText.includes('could not find');
      if (passbookResult.error && !passbookMissing) {
        throw passbookResult.error;
      }

      const passbookRows = (passbookResult.data || []).map(sanitizePassbookRowForUi);
      const passbookPaymentIds = new Set(passbookRows.map((row) => row.metadata?.razorpay_payment_id).filter(Boolean));
      const legacyTransactions = (transactionResult.data || [])
        .filter((row) => !passbookPaymentIds.has(row.metadata?.razorpay_payment_id))
        .map((row) => ({
          ...row,
          description: maskTokenText(row.description),
          type: row.transaction_type,
          metadata: {
            purpose: row.metadata?.purpose,
            package_id: row.metadata?.package_id,
            ai_messages: row.metadata?.ai_messages,
            razorpay_payment_id: row.metadata?.razorpay_payment_id,
            razorpay_order_id: row.metadata?.razorpay_order_id,
            meta_fee: row.metadata?.meta_fee,
            total_amount: row.metadata?.total_amount,
          },
        }));

      return res.status(200).json({
        success: true,
        transactions: [...passbookRows, ...legacyTransactions]
          .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
      });
    }

    let query = db
      .from('wallet_transactions')
      .select('id,user_id,amount,transaction_type,description,metadata,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const transactions = (data || []).map((row) => ({
      ...row,
      type: row.transaction_type,
    }));

    return res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    console.error('[YogiDesk Wallet] Transaction lookup failed:', error.message || error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load wallet transactions.',
      transactions: [],
    });
  }
};

module.exports = {
  createWalletOrder,
  getWalletTransactions,
  verifyWalletPayment,
};
