import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDownCircle, ArrowUpCircle, Clock, Gift, Send, Wallet } from 'lucide-react';
import api from '../utils/api';
import { PRICING_RULES } from '../constants/templateLibrary';
import { useWallet } from '../context/WalletContext';

const quickAmounts = [200, 500, 1000];

const loadRazorpayScript = () => new Promise((resolve) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const YogiWallet = () => {
  const { wallet, transactions, loading, userId, fetchPassbookTransactions, refreshWalletData } = useWallet();
  const [amount, setAmount] = useState(200);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const profile = useMemo(() => ({
    firstname: localStorage.getItem('user_name') || 'Yogi Desk User',
    email: localStorage.getItem('user_email') || '',
    phone: localStorage.getItem('user_phone') || '',
  }), []);

  useEffect(() => {
    const status = searchParams.get('payment');
    const paidAmount = searchParams.get('amt');
    if (!status) return;

    if (status === 'success') {
      setPaymentStatus(`Payment successful${paidAmount ? `: Rs. ${paidAmount}` : ''}. Wallet balance synced.`);
      refreshWalletData(userId);
    } else if (status === 'failed') {
      setPaymentError('Payment failed or was cancelled. No amount was added.');
      refreshWalletData(userId);
    }

    setSearchParams({}, { replace: true });
  }, [refreshWalletData, searchParams, setSearchParams, userId]);

  const handleRazorpayRecharge = async (event) => {
    event.preventDefault();
    const rechargeAmount = Number(amount);
    const amountInput = String(amount).trim();

    setPaymentError('');
    setPaymentStatus('');
    if (!userId) {
      setPaymentError('Unable to identify your account. Please login again.');
      return;
    }
    if (!Number.isFinite(rechargeAmount) || rechargeAmount < 10) {
      setPaymentError('Minimum recharge amount is Rs. 10.');
      alert('Minimum recharge amount is Rs. 10.');
      return;
    }
    if (!profile.email) {
      setPaymentError('Email is required before opening Razorpay checkout.');
      return;
    }

    try {
      setPaying(true);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Payment gateway failed to load. Please try again.');
      }

      const { data } = await api.post('/api/wallet/create-order', {
        userId,
        amount: amountInput,
      });

      if (!data?.success || !data?.order_id) {
        throw new Error(data?.message || 'Failed to initialize Razorpay checkout.');
      }

      const checkout = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || 'INR',
        order_id: data.order_id,
        name: 'YogiDesk AI - Wallet Recharge',
        image: `${window.location.origin}/logo.png`,
        theme: {
          color: '#F97316',
        },
        prefill: {
          name: profile.firstname,
          email: profile.email,
          contact: profile.phone,
        },
        notes: {
          user_id: userId,
          purpose: 'wallet_recharge',
          amount: amountInput,
        },
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/api/wallet/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId,
              amount: amountInput,
            });

            if (!verifyRes.data?.success) {
              throw new Error(verifyRes.data?.message || 'Payment verification failed.');
            }

            setPaymentStatus(`Payment successful: Rs. ${rechargeAmount.toFixed(2)}. Wallet balance synced.`);
            await fetchPassbookTransactions(userId);
            await refreshWalletData(userId);
          } catch (error) {
            console.error('Razorpay verification failed:', error);
            setPaymentError(error.response?.data?.message || error.message || 'Payment verification failed. Please contact support.');
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
      setPaymentError(error.message || 'Payment gateway failed to initialize. Please try again.');
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
              <div className="mt-3 text-4xl font-black sm:text-5xl">
                {loading ? <div className="h-10 w-32 animate-pulse rounded-lg bg-white/20" /> : `Rs. ${Number(wallet.balance || 0).toFixed(2)}`}
              </div>
            </div>
          </div>
          {wallet.welcome_gift_active && !loading && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              <Gift size={20} className="mt-0.5 shrink-0" />
              <span>Welcome Gift: Rs. 50.00 Free WhatsApp Credits Active</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <form onSubmit={handleRazorpayRecharge} className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black text-slate-950">Recharge Wallet</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Pay securely via Razorpay.</p>

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
              min={10}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4 text-lg font-black text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
            />
            {paymentStatus && (
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                {paymentStatus}
              </div>
            )}
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
                {loading ? (
                  [1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td className="p-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-100" /></td>
                      <td className="p-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                      <td className="p-4"><div className="h-4 w-16 animate-pulse rounded bg-slate-100" /></td>
                    </tr>
                  ))
                ) : (
                  transactions.map((tx) => {
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
                  })
                )}
              </tbody>
            </table>
            {transactions.length === 0 && !loading && (
              <div className="p-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400 sm:p-16">
                <div className="flex flex-col items-center gap-2">
                  <Clock size={32} className="text-slate-200" />
                  <span>No transaction history found</span>
                </div>
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
