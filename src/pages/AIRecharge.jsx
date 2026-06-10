import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Clock, CreditCard, Download, Gauge, IndianRupee, MessageSquare, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';

const AI_PACKAGES = [
  { id: 'starter_ai', name: 'Starter AI', price: 299, messages: 600, cost: '~Rs. 0.49 / message' },
  { id: 'growth_ai', name: 'Growth AI', price: 599, messages: 1500, cost: '~Rs. 0.39 / message', featured: true },
  { id: 'professional_ai', name: 'Professional AI', price: 999, messages: 3000, cost: '~Rs. 0.33 / message' },
  { id: 'clinic_pro_ai', name: 'Clinic Pro AI', price: 1999, messages: 7000, cost: '~Rs. 0.28 / message' },
];

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

const calculateCustomMessages = (price) => {
  const value = Number(price);
  if (!Number.isFinite(value) || value < 100) return 0;
  return Math.floor(value * (value < 500 ? 2.0 : 2.5));
};

const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsv = (rows) => {
  const headers = ['Date', 'Package', 'Amount INR', 'AI Messages', 'Payment ID', 'Status'];
  const body = rows.map((row) => {
    const metadata = row.metadata || {};
    return [
      new Date(row.created_at).toLocaleString('en-IN'),
      metadata.package_id || 'AI Message Credits',
      Number(row.amount || 0).toFixed(2),
      Number(metadata.ai_messages || 0),
      metadata.razorpay_payment_id || '',
      'Success',
    ].map(csvCell).join(',');
  });

  const blob = new Blob([[headers.map(csvCell).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `yogidesk-ai-message-statement-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const AIRecharge = () => {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState(AI_PACKAGES[1]);
  const [customAmount, setCustomAmount] = useState(500);
  const [mode, setMode] = useState('package');
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [aiLedger, setAiLedger] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const customMessages = useMemo(() => calculateCustomMessages(customAmount), [customAmount]);
  const checkoutDetails = mode === 'custom'
    ? { packageId: 'custom', name: 'Custom AI Messages', price: Number(customAmount), messages: customMessages }
    : selectedPackage;

  const fetchAiLedger = async () => {
    try {
      setLedgerLoading(true);
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult?.user?.id || localStorage.getItem('user_id');
      if (!userId) {
        setAiLedger([]);
        return;
      }

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('id, amount, transaction_type, description, metadata, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAiLedger((data || []).filter((row) => (
        row.transaction_type === 'AI_MESSAGE_CREDIT' ||
        row.metadata?.purpose === 'ai_message_recharge'
      )));
    } catch (ledgerError) {
      console.warn('AI message passbook unavailable:', ledgerError?.message || ledgerError);
      setAiLedger([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchAiLedger();
  }, []);

  const startCheckout = async () => {
    setError('');
    setStatus('');
    if (!checkoutDetails || !Number.isFinite(checkoutDetails.price) || checkoutDetails.price < 100 || checkoutDetails.messages <= 0) {
      setError('Minimum custom recharge amount is Rs. 100.');
      return;
    }

    try {
      setLoading(true);
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Payment gateway failed to load. Please try again.');

      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult?.user?.id || localStorage.getItem('user_id');
      const email = userResult?.user?.email || localStorage.getItem('user_email') || '';
      const phone = userResult?.user?.user_metadata?.phone || localStorage.getItem('user_phone') || '';
      const name = userResult?.user?.user_metadata?.full_name || localStorage.getItem('user_name') || 'Yogi Desk User';

      if (!userId) throw new Error('Please login again before recharging AI messages.');

      const { data } = await api.post('/api/payments/create-ai-order', {
        userId,
        packageId: mode === 'custom' ? 'custom' : checkoutDetails.id,
        amount: checkoutDetails.price,
      });

      if (!data?.success || !data?.order_id) {
        throw new Error(data?.message || 'Unable to initialize AI message checkout.');
      }

      const checkout = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || 'INR',
        order_id: data.order_id,
        name: 'YogiDesk AI - Message Credits Topup',
        image: `${window.location.origin}/logo.png`,
        theme: { color: '#F97316' },
        prefill: { name, email, contact: phone },
        notes: {
          purpose: 'ai_message_recharge',
          package_id: data.packageId,
          ai_messages: String(data.aiMessages),
        },
        handler: async (response) => {
          try {
            const verifyRes = await api.post('/api/payments/verify-ai-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId,
              packageId: data.packageId,
              amount: data.rupeeAmount,
              aiMessages: data.aiMessages,
            });

            if (!verifyRes.data?.success) {
              throw new Error(verifyRes.data?.message || 'Payment verification failed.');
            }

            setStatus(`${Number(data.aiMessages).toLocaleString()} AI Assistant Messages added successfully.`);
            await fetchAiLedger();
          } catch (verifyError) {
            setError(verifyError.response?.data?.message || verifyError.message || 'Payment verification failed. Please contact support.');
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      checkout.open();
    } catch (checkoutError) {
      setLoading(false);
      setError(checkoutError.response?.data?.message || checkoutError.message || 'Unable to start checkout.');
    }
  };

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 text-orange-600">
                <Bot size={24} />
                <p className="text-xs font-black uppercase tracking-[0.22em]">AI Assistant Messages</p>
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Recharge AI Message Credits</h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                1 AI Message Credit = 1 Full AI Response to a Patient&apos;s Query.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/ai-settings')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
            >
              <Gauge size={16} />
              Usage Settings
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          {AI_PACKAGES.map((item) => {
            const active = mode === 'package' && selectedPackage.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setMode('package');
                  setSelectedPackage(item);
                }}
                className={`relative rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  active ? 'border-orange-500 ring-4 ring-orange-100' : 'border-slate-200'
                }`}
              >
                {item.featured && (
                  <span className="absolute right-4 top-4 rounded-full bg-orange-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-700">
                    Popular
                  </span>
                )}
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <MessageSquare size={21} />
                </div>
                <h2 className="mt-5 text-lg font-black text-slate-950">{item.name}</h2>
                <p className="mt-2 flex items-center gap-1 text-3xl font-black text-slate-950">
                  <IndianRupee size={24} />
                  {item.price.toLocaleString()}
                </p>
                <p className="mt-3 text-sm font-black text-orange-700">{item.messages.toLocaleString()} AI Messages</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{item.cost}</p>
                {active && <CheckCircle2 className="absolute bottom-4 right-4 text-orange-600" size={22} />}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_0.6fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <SlidersHorizontal size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Custom Amount</h2>
                <p className="text-xs font-bold text-slate-500">Minimum Rs. 100. Higher recharges unlock better message value.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-[1fr_180px] md:items-center">
              <input
                type="range"
                min={100}
                max={5000}
                step={50}
                value={customAmount}
                onChange={(event) => {
                  setMode('custom');
                  setCustomAmount(event.target.value);
                }}
                className="h-2 w-full accent-orange-600"
              />
              <input
                type="number"
                min={100}
                value={customAmount}
                onChange={(event) => {
                  setMode('custom');
                  setCustomAmount(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-black text-slate-950 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
              />
            </div>
            <div className={`mt-5 rounded-2xl border p-4 ${mode === 'custom' ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
              <p className="text-sm font-black text-slate-950">
                You will get {customMessages.toLocaleString()} AI Messages for Rs. {Number(customAmount || 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">Every plan is customized to optimize patient care automation. Higher tiers unlock higher bonus assistant capabilities dynamically.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex items-center gap-3 text-orange-300">
              <Sparkles size={20} />
              <p className="text-xs font-black uppercase tracking-widest">Checkout Summary</p>
            </div>
            <h2 className="mt-4 text-2xl font-black">{checkoutDetails.name}</h2>
            <p className="mt-3 text-4xl font-black">Rs. {Number(checkoutDetails.price || 0).toLocaleString()}</p>
            <p className="mt-2 text-sm font-bold text-slate-300">
              {Number(checkoutDetails.messages || 0).toLocaleString()} AI Messages (Send/Receive)
            </p>
            {status && <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">{status}</div>}
            {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">{error}</div>}
            <button
              type="button"
              disabled={loading}
              onClick={startCheckout}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard size={18} />
              {loading ? 'Opening Checkout...' : 'Proceed to Buy Credits'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Clock size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">AI Credits Passbook</h2>
                <p className="text-xs font-bold text-slate-500">Statement of successful AI Assistant Message purchases.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => downloadCsv(aiLedger)}
              disabled={aiLedger.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Export Statement
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Package</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Messages</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Amount</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ledgerLoading ? (
                  [1, 2, 3].map((item) => (
                    <tr key={item}>
                      <td className="p-4"><div className="h-4 w-28 animate-pulse rounded bg-slate-100" /></td>
                      <td className="p-4"><div className="h-4 w-32 animate-pulse rounded bg-slate-100" /></td>
                      <td className="p-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                      <td className="p-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-100" /></td>
                      <td className="p-4"><div className="h-4 w-36 animate-pulse rounded bg-slate-100" /></td>
                    </tr>
                  ))
                ) : (
                  aiLedger.map((row) => {
                    const metadata = row.metadata || {};
                    return (
                      <tr key={row.id} className="transition hover:bg-slate-50/70">
                        <td className="p-4 text-sm font-semibold text-slate-600">
                          {new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 text-sm font-black text-slate-900">{metadata.package_id || 'AI Message Credits'}</td>
                        <td className="p-4 text-sm font-black text-orange-700">+{Number(metadata.ai_messages || 0).toLocaleString()} AI Messages</td>
                        <td className="p-4 text-sm font-black text-slate-900">Rs. {Number(row.amount || 0).toFixed(2)}</td>
                        <td className="p-4 text-xs font-bold text-slate-500">{metadata.razorpay_payment_id || 'Verified payment'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {!ledgerLoading && aiLedger.length === 0 && (
              <div className="p-10 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                No AI credit purchases found
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIRecharge;
