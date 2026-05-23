import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Clock, Gift, Send, Wallet } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { PRICING_RULES } from '../constants/templateLibrary';
import { saveWallet } from '../utils/wallet';

const quickAmounts = [200, 500, 1000];
const normalizeSupabaseId = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.id || value.user_id || value.sub || '').trim();
  return String(value || '').trim();
};
const isCleanFilterValue = (value) => Boolean(value && value !== 'undefined' && value !== 'null' && value !== '[object Object]');

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }

  const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existing) {
    existing.addEventListener('load', () => resolve(true), { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => resolve(true);
  script.onerror = reject;
  document.body.appendChild(script);
});

const YogiWallet = () => {
  const [wallet, setWallet] = useState({ balance: 50, is_first_recharge: true, welcome_gift_active: true });
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState(200);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const userId = normalizeSupabaseId(localStorage.getItem('user_id'));

  const fetchWalletData = useCallback(async () => {
    if (!isCleanFilterValue(userId)) return;

    const { data, error } = await supabase
      .from('wallets')
      .select('balance,is_first_recharge,welcome_gift_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      setWallet(data);
      saveWallet(data);
      return;
    }

    const defaultWallet = {
      user_id: userId,
      balance: 50.00,
      is_first_recharge: true,
      welcome_gift_active: true,
      current_plan: 'starter',
      plan_tier: 'starter',
      lifetime_contacts_count: 0,
    };

    const { data: createdWallet, error: createError } = await supabase
      .from('wallets')
      .upsert(defaultWallet, { onConflict: 'user_id', ignoreDuplicates: true })
      .select('balance, is_first_recharge, welcome_gift_active')
      .single();

    if (!createError && createdWallet) {
      setWallet(createdWallet);
      saveWallet(createdWallet);
    }
  }, [userId]);

  const fetchTransactions = useCallback(async () => {
    if (!isCleanFilterValue(userId)) return;
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) setTransactions(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchWalletData();
    fetchTransactions();
  }, [fetchWalletData, fetchTransactions]);

  const creditWallet = async (rechargeAmount, paymentResponse) => {
    if (!isCleanFilterValue(userId)) return;

    const { data: currentWallet, error } = await supabase
      .from('wallets')
      .select('balance,welcome_gift_active')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    const newBalance = Number((Number(currentWallet?.balance || 0) + rechargeAmount).toFixed(2));

    await supabase.from('wallets').upsert({
      user_id: userId,
      balance: newBalance,
      is_first_recharge: false,
      welcome_gift_active: currentWallet?.welcome_gift_active ?? false,
      current_plan: 'starter',
      plan_tier: 'starter',
    }, { onConflict: 'user_id' });

    await supabase.from('wallet_transactions').insert([{
      user_id: userId,
      amount: rechargeAmount,
      type: 'recharge',
      description: 'Recharged via Razorpay Checkout',
      metadata: {
        provider: 'razorpay',
        payment_id: paymentResponse?.razorpay_payment_id || null,
      },
      created_at: new Date().toISOString()
    }]);

    await fetchWalletData();
    await fetchTransactions();
  };

  const handleProceedToRecharge = async (event) => {
    event.preventDefault();
    const rechargeAmount = Number(amount);
    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;

    setPaymentError('');
    if (!isCleanFilterValue(userId) || !Number.isFinite(rechargeAmount)) return;
    if (rechargeAmount < 100) {
      setPaymentError('Minimum recharge amount is ₹100.');
      alert('Minimum recharge amount is ₹100.');
      return;
    }
    if (!razorpayKey) {
      alert('Razorpay key is missing. Please contact support.');
      return;
    }

    try {
      setPaying(true);
      await loadRazorpayCheckout();

      const checkout = new window.Razorpay({
        key: razorpayKey,
        amount: Math.round(rechargeAmount * 100),
        currency: 'INR',
        name: 'Yogi Desk',
        description: 'WhatsApp Credits Recharge',
        prefill: {
          name: localStorage.getItem('user_name') || 'Yogi Desk User',
          email: localStorage.getItem('user_email') || '',
          contact: localStorage.getItem('user_phone') || '',
        },
        theme: { color: '#ff6b00' },
        handler: async (response) => {
          try {
            await creditWallet(rechargeAmount, response);
          } catch (error) {
            console.error('Wallet credit failed:', error);
            alert('Payment captured, but wallet sync failed. Please contact support.');
          } finally {
            setPaying(false);
          }
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });

      checkout.open();
    } catch (error) {
      setPaying(false);
      console.error('Razorpay initialization failed:', error);
      alert('Payment gateway failed to initialize. Please try again.');
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] p-4 font-sans sm:p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-orange-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">Yogi Wallet</p>
              <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">WhatsApp Credits</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500">
                Recharge prepaid credits for appointment reminders, patient updates, and approved marketing templates.
              </p>
            </div>
            <div className="rounded-[2rem] bg-slate-950 px-6 py-6 text-white sm:px-8">
              <div className="flex items-center gap-3 text-orange-300">
                <Wallet size={22} />
                <span className="text-xs font-black uppercase tracking-widest">Available Balance</span>
              </div>
              <div className="mt-3 text-4xl font-black sm:text-5xl">Rs. {Number(wallet.balance || 0).toFixed(2)}</div>
            </div>
          </div>

          {wallet.welcome_gift_active && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              <Gift size={20} className="mt-0.5 shrink-0" />
              <span>Welcome Gift: Rs. 50.00 Free WhatsApp Credits Active</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <form onSubmit={handleProceedToRecharge} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black text-slate-950">Recharge Wallet</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Pay securely through Razorpay checkout.</p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {quickAmounts.map((quickAmount) => (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => setAmount(quickAmount)}
                  className={`rounded-2xl border px-3 py-3 text-sm font-black transition sm:px-4 ${
                    Number(amount) === quickAmount
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 text-slate-600 hover:border-orange-200'
                  }`}
                >
                  Rs. {quickAmount}
                </button>
              ))}
            </div>

            <label className="mt-6 block text-xs font-black uppercase tracking-widest text-slate-400">Recharge Amount</label>
            <input
              type="number"
              min={100}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-lg font-black text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
            {paymentError && (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {paymentError}
              </div>
            )}

            <button
              type="submit"
              disabled={paying}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Wallet size={18} /> {paying ? 'Opening Checkout...' : 'Recharge Wallet'}
            </button>
          </form>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black text-slate-950">Message Rates</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center gap-3 text-blue-700">
                  <Send size={20} />
                  <p className="text-sm font-black uppercase tracking-widest">Utility / Appointment Reminders</p>
                </div>
                <p className="mt-3 text-3xl font-black text-slate-950">Rs. {PRICING_RULES.UTILITY.toFixed(2)} / msg</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Fixed rate for appointment reminders and patient updates.</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                <div className="flex items-center gap-3 text-orange-700">
                  <Send size={20} />
                  <p className="text-sm font-black uppercase tracking-widest">Marketing / Promotional Broadcasts</p>
                </div>
                <p className="mt-3 text-3xl font-black text-slate-950">Rs. {PRICING_RULES.MARKETING.toFixed(2)} / msg</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Fixed rate for offers, camps, and promotional campaigns.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Clock className="text-slate-400" size={24} />
            <h2 className="text-2xl font-black text-slate-950">Transaction Passbook</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Activity</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map((tx) => {
                  const isCredit = tx.type === 'CREDIT' || tx.type === 'recharge';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-600">
                        {new Date(tx.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {isCredit ? <ArrowUpCircle size={14} className="text-emerald-500" /> : <ArrowDownCircle size={14} className="text-rose-500" />}
                          <span className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {isCredit ? 'Recharge' : 'Debit'}
                          </span>
                        </div>
                      </td>
                      <td className={`p-4 text-sm font-black ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'} Rs. {Math.abs(tx.amount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {transactions.length === 0 && !loading && (
              <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400 sm:p-16">
                No transaction history found
              </div>
            )}
            {loading && (
              <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400 animate-pulse sm:p-16">
                Fetching records...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default YogiWallet;
