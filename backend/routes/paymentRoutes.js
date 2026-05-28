const express = require('express');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { supabaseAdmin, supabase } = require('../config/supabase');

const router = express.Router();
const db = supabaseAdmin || supabase;

const PAYU_CHECKOUT_URL = 'https://secure.payu.in/_payment';
const FRONTEND_WALLET_URL = 'https://yogidesk-ai.com/dashboard/wallet';
const API_BASE_URL = 'https://api.yogidesk-ai.com';

const sha512 = (value) => crypto.createHash('sha512').update(value).digest('hex');
const getPayuCredentials = () => ({
  key: String(process.env.PAYU_MERCHANT_KEY || '').trim(),
  salt: String(process.env.PAYU_MERCHANT_SALT || '').trim(),
});

const normalizeAmount = (value) => {
  const amount = parseFloat(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : null;
};

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
    const udf1 = '';
    const udf2 = '';
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
    const incomingHash = String(req.body?.hash || '').trim();
    const userId = productinfo;

    const reverseHashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
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
      type: 'CREDIT',
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

module.exports = router;
