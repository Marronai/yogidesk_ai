import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CheckCircle2, Clock, CreditCard, Download, Gauge, IndianRupee, MessageSquare, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';
import { exportFinancialStatementPdf } from '../utils/statementExport';

const AI_PACKAGES = [
  { id: 'tier_1_ai', name: 'Starter Clinic AI', price: 299, messages: 5000, cost: '~16.72 messages / ₹1' },
  { id: 'tier_2_ai', name: 'Growth Clinic AI', price: 599, messages: 13000, cost: '~21.70 messages / ₹1', featured: true },
  { id: 'tier_3_ai', name: 'Premium Care AI', price: 999, messages: 32000, cost: '~32.03 messages / ₹1' },
  { id: 'tier_4_ai', name: 'Medical Pro Enterprise AI', price: 1999, messages: 60000, cost: '~30.02 messages / ₹1' },
];
const ITEMS_PER_PAGE = 10;
const CUSTOM_MIN_AMOUNT = 100;
const CUSTOM_MAX_AMOUNT = 1999;
const CUSTOM_MESSAGE_FACTOR = 5000 / 299;
const META_FEE_RATE = 0.0236;
const FIXED_PACKAGE_BY_PRICE = AI_PACKAGES.reduce((lookup, item) => ({
  ...lookup,
  [item.price]: item,
}), {});

const AI_TERMS_COPY = {
  EN: {
    toggleLabel: 'English',
    badge: 'Secure Consent Required',
    footer: 'Doctor Transparency Note: At YogiDesk, we maintain absolute pricing transparency so that our respected doctors know exactly how their automation capital is utilized to scale their medical practice efficiently.',
    checkbox: 'I have read and agree to YogiDesk AI Service Terms & Conditions',
    points: [
      {
        title: 'Infrastructure Dependency',
        text: 'YogiDesk integrates compute infrastructures from global AI research leaders including Google AI, OpenAI, and NVIDIA. If these infrastructure entities scale their pricing structures, YogiDesk credit tariffs may adjust proportionally.',
      },
      {
        title: 'Model Obsolescence & Upgrades',
        text: 'If an active AI model version is retired by the parent company or higher baseline model updates are required to retain clinic performance, package adjustments may occur.',
      },
      {
        title: '7-Day Advanced Notice Grace Window',
        text: 'We pledge complete operational transparency. Respected doctors will receive an explicit SMS or dashboard notification alert exactly 7 days prior to any official pricing revision before any modifications hit active wallets.',
      },
      {
        title: 'Service SLA & System Fail-safes',
        text: 'YogiDesk functions as an autonomous digital clinic receptionist. In rare anomalies of cloud network drops, API system freezes, or upstream server downtime, YogiDesk assumes no liability. Our engineering layer will notify you immediately via mail/SMS for temporary manual inbox monitoring.',
      },
      {
        title: 'Computational Bracket Mapping',
        text: 'To enforce fair usage billing, message deductions calculate programmatically via computation brackets. Short inquiries consume single base units, while long, multi-turn medical history scheduling blocks tap across higher fractional usage.',
      },
    ],
  },
  HI: {
    toggleLabel: 'Hinglish',
    badge: 'Secure Consent Zaroori Hai',
    footer: 'Doctor Transparency Note: YogiDesk mein hum clear pricing transparency maintain karte hain, taaki respected doctors ko exactly pata rahe ki unka automation capital clinic growth ke liye kaise utilize ho raha hai.',
    checkbox: 'Maine YogiDesk AI Service Terms & Conditions padh liye hain aur main inhe accept karta/karti hoon',
    points: [
      {
        title: 'Infrastructure Dependency',
        text: 'YogiDesk AI ka system Google AI, OpenAI, aur NVIDIA ke live servers se juda hua hai. Agar in tech giants ki taraf se computational pricing badhti hai, toh YogiDesk ke message credit rates badle ja sakte hain.',
      },
      {
        title: 'Model Obsolescence & Upgrades',
        text: 'Agar parent company kisi active AI model version ko retire karti hai, ya clinic performance maintain karne ke liye higher baseline model upgrade zaroori hota hai, toh package structure mein adjustment ho sakta hai.',
      },
      {
        title: '7-Day Advanced Notice Grace Window',
        text: 'Hum complete operational transparency ka promise karte hain. Kisi bhi official pricing revision se exactly 7 din pehle respected doctors ko SMS ya dashboard notification ke through clear alert diya jayega.',
      },
      {
        title: 'Service SLA & System Fail-safes',
        text: 'YogiDesk AI aapke clinic ke liye ek 24/7 autonomous receptionist ki tarah kaam karta hai. Par kisi rare case mein global server down ya Meta API maintenance ke wajah se agar koi message skip hota hai, toh uski legal jimmedari hamari nahi hogi. Aise hone par aapko SMS/Email se alert bhej diya jayega taaki aap manual oversight kar sakein.',
      },
      {
        title: 'Computational Bracket Mapping',
        text: 'Deduction Calculation Metric Rule: Fair usage billing ke liye message credit deduction patient ke sawal ki lambai aur context depth (tokens) ke brackets par calculated hota hai. Chote sawalon par kam credit aur lambi chat session par us hisab se 2 se 6 credits tak deduct ho sakte hain.',
      },
    ],
  },
};

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
  if (!Number.isFinite(value) || value < CUSTOM_MIN_AMOUNT) return 0;
  const fixedPackage = FIXED_PACKAGE_BY_PRICE[value];
  if (fixedPackage) return fixedPackage.messages;
  return Math.floor(value * CUSTOM_MESSAGE_FACTOR);
};

const resolveCustomPackageName = (amount) => FIXED_PACKAGE_BY_PRICE[Number(amount)]?.name || 'Custom AI Messages';

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

const AIRecharge = () => {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState(AI_PACKAGES[1]);
  const [customAmount, setCustomAmount] = useState(500);
  const [mode, setMode] = useState('package');
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [aiLedger, setAiLedger] = useState([]);
  const [ledgerPage, setLedgerPage] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [language, setLanguage] = useState('EN');

  const customMessages = useMemo(() => calculateCustomMessages(customAmount), [customAmount]);
  const termsCopy = AI_TERMS_COPY[language] || AI_TERMS_COPY.EN;
  const checkoutDetails = mode === 'custom'
    ? { packageId: 'custom', name: resolveCustomPackageName(customAmount), price: Number(customAmount), messages: customMessages }
    : selectedPackage;
  const subtotal = Number(checkoutDetails.price || 0);
  const metaFee = Number((subtotal * META_FEE_RATE).toFixed(2));
  const totalToPay = Number((subtotal + metaFee).toFixed(2));
  const sortedAiLedger = useMemo(() => (
    [...aiLedger].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
  ), [aiLedger]);
  const totalLedgerPages = Math.max(1, Math.ceil(sortedAiLedger.length / ITEMS_PER_PAGE));
  const visibleAiLedger = sortedAiLedger.slice(ledgerPage * ITEMS_PER_PAGE, (ledgerPage + 1) * ITEMS_PER_PAGE);

  useEffect(() => {
    if (ledgerPage > totalLedgerPages - 1) setLedgerPage(Math.max(0, totalLedgerPages - 1));
  }, [ledgerPage, totalLedgerPages]);

  const fetchAiLedger = async () => {
    try {
      setLedgerLoading(true);
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult?.user?.id || localStorage.getItem('user_id');
      if (!userId) {
        setAiLedger([]);
        return;
      }

      const { data } = await api.get('/api/wallet/transactions', {
        params: {
          userId,
          purpose: 'ai_message_recharge',
        },
      });

      if (!data?.success) throw new Error(data?.message || 'Unable to load AI message statement.');
      setAiLedger(data.transactions || []);
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

  const exportAiStatement = async () => {
    await exportFinancialStatementPdf({
      title: 'AI Credits Statement',
      filenamePrefix: 'ai-credits-statement',
      rows: sortedAiLedger.map((row) => {
        const metadata = row.metadata || {};
        return {
          date: new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          activity: metadata.package_id || 'AI Message Credits',
          value: `${Number(metadata.messages_delta ?? metadata.ai_messages ?? 0).toLocaleString()} Messages / ₹${Number(row.amount || 0).toFixed(2)}`,
          status: 'Success',
        };
      }),
    });
  };

  const validateCheckoutDetails = () => {
    setError('');
    setStatus('');
    if (
      !checkoutDetails
      || !Number.isFinite(checkoutDetails.price)
      || checkoutDetails.price < CUSTOM_MIN_AMOUNT
      || (mode === 'custom' && checkoutDetails.price > CUSTOM_MAX_AMOUNT)
      || checkoutDetails.messages <= 0
    ) {
      setError('Custom recharge amount must be between ₹100 and ₹1,999.');
      return false;
    }
    return true;
  };

  const handleProceedClick = () => {
    if (!validateCheckoutDetails()) return;
    setTermsAccepted(false);
    setTermsModalOpen(true);
  };

  const startCheckout = async () => {
    if (!termsAccepted || !validateCheckoutDetails()) return;
    setTermsModalOpen(false);

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
              <p className="text-xs font-bold text-slate-500">Minimum ₹100. Exact package amounts use the fixed allocation.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-[1fr_180px] md:items-center">
              <input
                type="range"
                min={CUSTOM_MIN_AMOUNT}
                max={CUSTOM_MAX_AMOUNT}
                step={1}
                value={customAmount}
                onChange={(event) => {
                  setMode('custom');
                  setCustomAmount(event.target.value);
                }}
                className="h-2 w-full accent-orange-600"
              />
              <input
                type="number"
                min={CUSTOM_MIN_AMOUNT}
                max={CUSTOM_MAX_AMOUNT}
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
                You will get {customMessages.toLocaleString()} AI Messages for ₹{Number(customAmount || 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">A ₹100 custom load allocates 1,672 messages. ₹299, ₹599, ₹999, and ₹1,999 use fixed package credits.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <div className="flex items-center gap-3 text-orange-300">
              <Sparkles size={20} />
              <p className="text-xs font-black uppercase tracking-widest">Order Summary</p>
            </div>
            <h2 className="mt-4 text-2xl font-black">{checkoutDetails.name}</h2>
            <p className="mt-2 text-sm font-bold text-slate-300">
              {Number(checkoutDetails.messages || 0).toLocaleString()} AI Messages (Send/Receive)
            </p>
            <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm font-bold">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300">Plan / Recharge Amount</span>
                <span className="shrink-0 text-white">{money(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300">Meta Fee</span>
                <span className="shrink-0 text-white">{money(metaFee)}</span>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between gap-4 text-base">
                  <span>Total To Pay</span>
                  <span className="shrink-0 text-orange-200">{money(totalToPay)}</span>
                </div>
              </div>
            </div>
            {status && <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">{status}</div>}
            {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-100">{error}</div>}
            <button
              type="button"
              disabled={loading}
              onClick={handleProceedClick}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CreditCard size={18} />
              {loading ? 'Opening Checkout...' : 'Proceed to Buy Credits'}
            </button>
          </div>
        </div>

        {termsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/75 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-6" role="dialog" aria-modal="true" aria-labelledby="ai-terms-title">
            <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-2xl">
              <div className="shrink-0 bg-[#501638] px-5 py-5 text-white sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-100">
                      <ShieldCheck size={14} />
                      {termsCopy.badge}
                    </div>
                    <h2 id="ai-terms-title" className="mt-3 text-2xl font-black leading-tight sm:text-3xl">YogiDesk AI Assistant — Terms & Conditions</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!loading) setTermsModalOpen(false);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading}
                    aria-label="Close terms modal"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 px-5 py-5 sm:px-7">
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-orange-100 bg-orange-50/60 px-3 py-3">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-700">Language</p>
                  <div className="inline-flex rounded-full border border-orange-200 bg-white p-1 shadow-sm">
                    {[
                      ['EN', 'English'],
                      ['HI', 'Hinglish'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLanguage(value)}
                        className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition ${
                          language === value ? 'bg-[#FF6B00] text-white shadow-sm' : 'text-slate-600 hover:bg-orange-50'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="max-h-[calc(90vh-116px)] overflow-y-auto pr-2 pb-24">
                <div className="space-y-3">
                  {termsCopy.points.map((point, index) => (
                    <div key={point.title} className="rounded-xl border border-orange-100 bg-[#fffaf3] p-4">
                      <p className="text-xs font-black uppercase tracking-widest text-orange-600">Point {index + 1}</p>
                      <h3 className="mt-1 text-sm font-black text-slate-950">{point.title}</h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-800">{point.text}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
                  <p className="text-sm font-black leading-6 text-slate-950">
                    {termsCopy.footer}
                  </p>
                </div>
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 border-t border-orange-100 bg-white px-5 py-4 shadow-[0_-16px_32px_rgba(15,23,42,0.12)] sm:px-7">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange-100 bg-orange-50/70 p-3 transition hover:border-orange-300">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) => setTermsAccepted(event.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-orange-600 accent-orange-600"
                  />
                  <span className="text-sm font-black leading-6 text-slate-800">
                    {termsCopy.checkbox}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={!termsAccepted || loading}
                  onClick={startCheckout}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] px-5 py-4 text-sm font-black uppercase tracking-widest text-white transition hover:bg-[#e65f00] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                >
                  <CreditCard size={18} />
                  {loading ? 'Opening Checkout...' : 'PROCEED TO PAY'}
                </button>
              </div>
            </div>
          </div>
        )}

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
              onClick={exportAiStatement}
              disabled={sortedAiLedger.length === 0}
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
                  <th className="p-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Activity</th>
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
                  visibleAiLedger.map((row) => {
                    const metadata = row.metadata || {};
                    const messageDelta = Number(metadata.messages_delta ?? metadata.ai_messages ?? 0);
                    const signedMessages = `${messageDelta < 0 ? '-' : '+'}${Math.abs(messageDelta).toLocaleString()} Messages`;
                    return (
                      <tr key={row.id} className="transition hover:bg-slate-50/70">
                        <td className="p-4 text-sm font-semibold text-slate-600">
                          {new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="p-4 text-sm font-black text-slate-900">{row.description || metadata.package_id || 'AI Message Credits'}</td>
                        <td className={`p-4 text-sm font-black ${messageDelta < 0 ? 'text-red-600' : 'text-orange-700'}`}>{signedMessages}</td>
                        <td className="p-4 text-sm font-black text-slate-900">₹{Number(row.amount || 0).toFixed(2)}</td>
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
          {sortedAiLedger.length > ITEMS_PER_PAGE && (
            <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Page {ledgerPage + 1} of {totalLedgerPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ledgerPage === 0}
                  onClick={() => setLedgerPage((page) => Math.max(0, page - 1))}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous Page
                </button>
                <button
                  type="button"
                  disabled={ledgerPage >= totalLedgerPages - 1}
                  onClick={() => setLedgerPage((page) => Math.min(totalLedgerPages - 1, page + 1))}
                  className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIRecharge;
