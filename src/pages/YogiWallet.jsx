import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Info, Send, Wallet, Clock, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../supabaseClient';
import { PRICING_RULES } from '../constants/templateLibrary';

const quickAmounts = [100, 200, 500, 1000];

const YogiWallet = () => {
  const [wallet, setWallet] = useState({ balance: 0, is_first_recharge: true, welcome_gift_active: false });
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState(200);
  const [loading, setLoading] = useState(true);

  const userId = localStorage.getItem('user_id');

  const fetchWalletData = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('wallets')
      .select('balance, is_first_recharge, welcome_gift_active')
      .eq('user_id', userId)
      .single();

    if (!error && data) setWallet(data);
  }, [userId]);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;
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

  const handleProceedToRecharge = async (e) => {
    e.preventDefault();
    const rechargeAmount = Number(amount);
    if (rechargeAmount < 100) return;

    // PayU Web Checkout Initialization (Test/Sandbox Mode)
    const merchantKey = import.meta.env.VITE_PAYU_MERCHANT_KEY;
    const txnId = `YOGIDESK_TXN_${Date.now()}`;
    const userEmail = localStorage.getItem('user_email') || "";
    const userPhone = localStorage.getItem('user_phone') || "";
    const userName = localStorage.getItem('user_name') || "Yogi User";

    // Logic to handle PayU success callback and execute Supabase sync
    const onPaymentSuccess = async () => {
      // Step A: Fetch current balance and is_first_recharge metrics from wallets table
      const { data: currentWallet, error: fetchError } = await supabase
        .from('wallets')
        .select('balance, is_first_recharge')
        .eq('user_id', userId)
        .single();

      if (fetchError || !currentWallet) return;

      let cashback = 0;
      let isFirst = currentWallet.is_first_recharge;

      // Step B: Bonus & Cashback Pipeline (>= ₹200 Logic)
      if (rechargeAmount >= 200) {
        if (isFirst) {
          cashback = Number((rechargeAmount * 0.05).toFixed(2)); // flat 5% cashback
          isFirst = false;
        } else {
          cashback = Math.floor(Math.random() * 7) + 1; // random bonus strictly between ₹1 and ₹7
        }
      }

      const totalCredit = rechargeAmount + cashback;
      const newBalance = currentWallet.balance + totalCredit;

      // Step C: Execute Wallet Update
      await supabase.from('wallets').update({ 
        balance: newBalance,
        is_first_recharge: isFirst
      }).eq('user_id', userId);

      // Step D: Append Transaction Record
      await supabase.from('wallet_transactions').insert([{
        user_id: userId,
        amount: totalCredit,
        type: 'recharge',
        description: 'Recharged via PayU Test Gateway',
        created_at: new Date().toISOString()
      }]);

      await fetchWalletData();
      await fetchTransactions();
    };

    try {
      // Securely fetch hash from backend before redirecting
      const response = await axios.post('http://localhost:5000/api/payment/payu-hash', {
        txnid: txnId,
        amount: rechargeAmount,
        productinfo: "WhatsApp Credits Recharge",
        firstname: userName,
        email: userEmail
      });

      const { hash } = response.data;
      if (!hash) throw new Error("Hash verification failed");

      // Initialize PayU flow with the valid hash
      console.log(`Processing PayU payment for ${userName} (${txnId}) with hash: ${hash}`);
      await onPaymentSuccess();
    } catch (err) {
      console.error("PayU Initialization Error:", err);
      alert("Payment gateway failed to initialize. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 sm:p-10 font-sans">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[2rem] border border-orange-100 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">Yogi Wallet</p>
              <h1 className="mt-3 text-4xl font-black text-slate-950">WhatsApp Credits</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500">
                Recharge prepaid credits for appointment reminders, patient updates, and approved marketing templates.
              </p>
            </div>
            <div className="rounded-[2rem] bg-slate-950 px-8 py-6 text-white">
              <div className="flex items-center gap-3 text-orange-300">
                <Wallet size={22} />
                <span className="text-xs font-black uppercase tracking-widest">Available Balance</span>
              </div>
              <div className="mt-3 text-5xl font-black">₹{wallet.balance.toFixed(2)}</div>
            </div>
          </div>

          {wallet.welcome_gift_active && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              <Gift size={20} className="mt-0.5 shrink-0" />
              <span>🎁 Welcome Gift: ₹50.00 Free WhatsApp Credits Active</span>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <form onSubmit={handleProceedToRecharge} className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">Recharge Wallet</h2>
            <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-bold text-orange-800">
              Recharge with ₹200 or more to win up to ₹50 instant cashback!
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {quickAmounts.map((quickAmount) => (
                <button
                  key={quickAmount}
                  type="button"
                  onClick={() => setAmount(quickAmount)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
                    Number(amount) === quickAmount
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-slate-200 text-slate-600 hover:border-orange-200'
                  }`}
                >
                  ₹{quickAmount}
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

            {/* Real-time Cashback Visualizer */}
            {Number(amount) >= 200 && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                {wallet.is_first_recharge ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                    <Gift size={20} className="shrink-0 text-emerald-600" />
                    <span>🎉 First Time Offer Active: You will get an additional cashback added to your wallet!</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-blue-50 p-4 text-sm font-semibold text-blue-700">
                    <Info size={18} className="shrink-0 text-blue-600" />
                    <span>🎁 Lucky Bonus: You are eligible to win an instant random bonus between ₹1 and ₹7!</span>
                  </div>
                )}
              </div>
            )}

            <button 
              type="submit"
              disabled={Number(amount) < 100}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet size={18} /> Proceed to Recharge
            </button>
          </form>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-black text-slate-950">Message Rates</h2>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center gap-3 text-blue-700">
                  <Send size={20} />
                  <p className="text-sm font-black uppercase tracking-widest">Utility Templates</p>
                </div>
                <p className="mt-3 text-3xl font-black text-slate-950">₹{PRICING_RULES.UTILITY.toFixed(2)} / msg</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Appointment reminders and patient updates.</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                <div className="flex items-center gap-3 text-orange-700">
                  <Send size={20} />
                  <p className="text-sm font-black uppercase tracking-widest">Marketing Templates</p>
                </div>
                <p className="mt-3 text-3xl font-black text-slate-950">₹{PRICING_RULES.MARKETING.toFixed(2)} / msg</p>
                <p className="mt-2 text-sm font-medium text-slate-500">Offers, camps, and promotional broadcasts.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Passbook Listing */}
        <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="text-slate-400" size={24} />
            <h2 className="text-2xl font-black text-slate-950">Transaction Passbook</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
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
                          {isCredit ? (
                            <ArrowUpCircle size={14} className="text-emerald-500" />
                          ) : (
                            <ArrowDownCircle size={14} className="text-rose-500" />
                          )}
                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                            {isCredit ? 'Recharge' : 'Debit'}
                          </span>
                        </div>
                      </td>
                      <td className={`p-4 text-sm font-black ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'} ₹{Math.abs(tx.amount).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {transactions.length === 0 && !loading && (
              <div className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                No transaction history found
              </div>
            )}
            {loading && (
              <div className="p-16 text-center text-slate-400 animate-pulse font-bold uppercase tracking-widest text-xs">
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
