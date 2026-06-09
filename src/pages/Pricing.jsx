import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Clock,
  Database,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  ToggleRight,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import PublicNavbar from '../components/PublicNavbar';
import api from '../utils/api';

const DURATIONS = [
  { id: '3m', label: '3 Months', saving: 'Starter cycle' },
  { id: '6m', label: '6 Months', saving: 'Save 15%' },
  { id: '12m', label: '1 Year', saving: 'Save 30%' },
];

const BASE_PRICES = {
  '3m': { starter: 199, growth: 399, multi: 799 },
  '6m': { starter: 169, growth: 339, multi: 679 },
  '12m': { starter: 139, growth: 279, multi: 559 },
};

const PLAN_CARDS = [
  {
    id: 'starter',
    title: 'Starter Clinic',
    subtitle: 'Solo doctor workspace for reliable patient reminders.',
    tone: 'slate',
    cta: 'Choose Plan',
    features: [
      'Database of 500 patients',
      '50+ doctor-specific WhatsApp templates',
      'Hindi, Hinglish, and English templates',
      'Appointment reminder automation',
      'Single workspace admin',
      'Basic broadcast analytics',
      '50 free credits on signup',
    ],
    unavailable: ['Staff seats', 'Shared team inbox', 'Patient smart assistant', 'Lab report delivery'],
  },
  {
    id: 'growth',
    title: 'Growth Clinic',
    subtitle: 'The conversion-focused plan for growing clinics.',
    tone: 'orange',
    cta: 'Select Plan',
    popular: true,
    features: [
      'Everything in Starter',
      'Database of 2,000 patients',
      'Admin + 2 staff seats',
      'Shared team inbox',
      'Human-takeover controls',
      'Patient smart assistant',
      'PDF and lab report delivery',
      'Review collection workflows',
      'Priority onboarding support',
    ],
  },
  {
    id: 'multi',
    title: 'Multi-Specialty',
    subtitle: 'For high-volume clinics with multiple teams.',
    tone: 'navy',
    cta: 'Choose Plan',
    features: [
      'Everything in Growth',
      'Database of 10,000 patients',
      'Admin + 5 staff seats',
      'Specialty-wise patient routing',
      'Multi-doctor and multi-location workspace',
      'Custom template library',
      'Revenue analytics and ROI tracking',
      'Dedicated onboarding manager',
    ],
  },
];

const COMPARISON_ROWS = [
  ['Platform subscription', 'Rs. 2,499/mo', 'API Only', 'From Rs. 139/mo'],
  ['Utility reminders cost', 'Rs. 1.50+', 'Rs. 1.80+', 'Only Rs. 0.20/msg'],
  ['Marketing broadcast cost', 'Rs. 1.50+', 'Rs. 1.80+', 'Only Rs. 1.30/msg'],
  ['Setup ease', 'Complex', 'Developer Required', '1-Click Doctor Workspace'],
  ['Patient Assistant Setup', 'Complex Flows', 'No Native Bot', '1-Click Patient Smart Assistant'],
];

const SECURITY_ITEMS = [
  { icon: Lock, label: 'HIPAA Compliant Storage Layouts' },
  { icon: Database, label: '100% Patient Database Separation' },
  { icon: ShieldCheck, label: 'End-to-End Encryption' },
];

const PLAN_BREAKDOWN_ROWS = [
  ['Patient database', '500 patients', '2,000 patients', '10,000 patients'],
  ['Staff / receptionist seats', 'Not included', 'Admin + 2 staff seats', 'Admin + 5 staff seats'],
  ['Shared team inbox', 'Not included', 'Included', 'Included'],
  ['Patient smart assistant', 'Not included', 'Included', 'Advanced routing'],
  ['Human-takeover toggle', 'Not included', 'Included', 'Included'],
  ['PDF / lab report delivery', 'Not included', 'Included', 'Included'],
  ['Review collection workflow', 'Not included', 'Included', 'Included'],
  ['Dedicated onboarding manager', 'Not included', 'Priority support', 'Dedicated manager'],
];

const SETUP_STEPS = [
  ['1', 'Choose Your Duration Plan', 'Select the plan and tenure that fits your clinic workflow.'],
  ['2', 'Connect Your Verified WhatsApp Number', 'Link verified messaging credentials with guided support.'],
  ['3', 'Run Automated Reminders', 'Launch appointment, report, and follow-up journeys.'],
];

const FAQS = [
  {
    question: 'Can I reuse my existing clinic number?',
    answer: 'Yes. If your number is eligible, our onboarding team guides the verified connection process without disturbing patient records.',
  },
  {
    question: 'Is my patient database separated from other clinics?',
    answer: 'Yes. Each workspace is isolated so clinic records, patient conversations, and automations remain separated.',
  },
  {
    question: 'Can my staff take over conversations manually?',
    answer: 'Yes. Human-takeover controls let your team pause automated responses instantly whenever a doctor or receptionist needs to step in.',
  },
];

const formatCurrency = (value) => `Rs. ${Math.round(value).toLocaleString('en-IN')}`;

const getSliderProgress = (value) => ((value - 500) / (20000 - 500)) * 100;

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }

  const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
  if (existingScript) {
    existingScript.addEventListener('load', () => resolve(true), { once: true });
    existingScript.addEventListener('error', reject, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => resolve(true);
  script.onerror = () => reject(new Error('Unable to load secure checkout.'));
  document.body.appendChild(script);
});

export default function Pricing() {
  const [durationId, setDurationId] = useState('12m');
  const [messageVolume, setMessageVolume] = useState(2000);
  const [openFaq, setOpenFaq] = useState(0);
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [loadingPlanId, setLoadingPlanId] = useState('');
  const [showLeadPopup, setShowLeadPopup] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowLeadPopup(true), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, []);

  const prices = useMemo(() => BASE_PRICES[durationId] || BASE_PRICES['12m'], [durationId]);

  const roi = useMemo(() => {
    const competitorCost = messageVolume * 2.5 + 2499;
    const yogiDeskCost = messageVolume * 0.2 + 279;
    return {
      competitorCost,
      yogiDeskCost,
      savings: competitorCost - yogiDeskCost,
    };
  }, [messageVolume]);

  const handleCheckout = async (planId) => {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const userId = user?.id || localStorage.getItem('user_id');
      if (!userId) {
        setCheckoutStatus({
          type: 'error',
          text: 'Please login first. Redirecting you to secure signup...',
        });
        window.setTimeout(() => {
          window.location.href = '/signup';
        }, 900);
        return;
      }

      const securePlanId = `${planId}_${durationId}`;
      setLoadingPlanId(securePlanId);
      setCheckoutStatus(null);

      await loadRazorpayCheckout();
      const response = await api.post('/api/payments/create-order', { planId: securePlanId });
      const order = response.data || {};
      if (!order.success || !order.order_id || !order.key_id) {
        throw new Error(order.message || 'Secure checkout could not be initialized.');
      }

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'YogiDesk AI',
        description: order.planName ? `${order.planName} Subscription` : 'YogiDesk AI Subscription',
        image: `${window.location.origin}/assets/yogidesk-logo.png`,
        order_id: order.order_id,
        prefill: {
          name: user?.user_metadata?.full_name || localStorage.getItem('user_name') || 'Doctor',
          email: user?.email || localStorage.getItem('user_email') || '',
        },
        notes: { plan_id: securePlanId },
        theme: { color: '#F97316' },
        handler: () => {
          setCheckoutStatus({
            type: 'success',
            text: 'Subscription initiated successfully! Redirecting to your updated secure workspace panel...',
          });
          window.setTimeout(() => {
            window.location.href = `/dashboard?subscription=initiated&plan=${encodeURIComponent(planId)}`;
          }, 1600);
        },
        modal: {
          escape: true,
          backdropclose: true,
          ondismiss: () => setLoadingPlanId(''),
        },
      });

      checkout.open();
    } catch (error) {
      console.error('Checkout error:', error?.response?.data || error.message || error);
      setLoadingPlanId('');
      setCheckoutStatus({
        type: 'error',
        text: error?.response?.data?.message || 'Unable to initialize secure checkout. Please try again.',
      });
    }
  };

  return (
    <div className="relative bg-slate-50 px-4 pb-16 pt-0 font-sans sm:px-6 lg:px-8">
      <PublicNavbar />

      <header className="mx-auto max-w-7xl pt-32">
        <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm sm:px-10 lg:px-16">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-orange-600">
            <Sparkles className="h-4 w-4" />
            PRICING PLANS
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-black tracking-tight text-[#071020] sm:text-5xl lg:text-6xl">
            Simple, Transparent Pricing for Smart Clinics
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg font-semibold leading-8 text-slate-600">
            Unlock automated patient communication and scale your digital presence. No hidden setup fees.
          </p>
        </div>
      </header>

      {checkoutStatus && (
        <div className={`mx-auto mt-8 max-w-7xl rounded-2xl border px-5 py-4 text-sm font-bold shadow-sm ${
          checkoutStatus.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {checkoutStatus.text}
        </div>
      )}

      <section className="mx-auto mt-10 max-w-7xl">
        <div className="mb-8 flex justify-center">
          <div className="grid w-full max-w-2xl grid-cols-1 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-3">
            {DURATIONS.map((item) => {
              const active = durationId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDurationId(item.id)}
                  className={`rounded-xl border px-5 py-3 text-left transition sm:text-center ${
                    active
                      ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-100'
                      : 'border-transparent bg-slate-50 text-slate-700 hover:border-orange-200'
                  }`}
                >
                  <span className="block text-sm font-black">{item.label}</span>
                  <span className={`mt-0.5 block text-xs font-bold ${active ? 'text-orange-100' : 'text-slate-500'}`}>{item.saving}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {PLAN_CARDS.map((plan) => {
            const activeKey = `${plan.id}_${durationId}`;
            const isLoading = loadingPlanId === activeKey;
            const isGrowth = plan.id === 'growth';
            return (
              <article
                key={plan.id}
                className={`relative flex min-h-[620px] flex-col overflow-hidden rounded-[28px] border bg-white shadow-sm ${
                  isGrowth ? 'border-orange-400 shadow-orange-100 lg:-translate-y-2' : 'border-slate-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-orange-500 px-3 py-1 text-xs font-black uppercase tracking-widest text-white">
                    Most Popular
                  </div>
                )}
                <div className="p-6 sm:p-8">
                  <h2 className="text-2xl font-black text-[#071020]">{plan.title}</h2>
                  <p className="mt-2 min-h-[48px] text-sm font-semibold leading-6 text-slate-500">{plan.subtitle}</p>
                  <div className="mt-6 flex items-end gap-1 text-[#071020]">
                    <span className="text-5xl font-black tracking-tight">Rs. {prices[plan.id]}</span>
                    <span className="pb-2 text-lg font-bold text-slate-500">/mo</span>
                  </div>

                  {isGrowth && (
                    <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50 p-4">
                      <div className="flex items-start gap-3">
                        <Bot className="mt-0.5 h-5 w-5 text-orange-600" />
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-orange-700">Smart Assistant Included</p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-orange-700">Patient queries, appointment capture, and front desk relief in one plan.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <ul className="mt-6 space-y-3 border-t border-slate-100 pt-5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-700">
                        <Check className={`mt-0.5 h-5 w-5 shrink-0 ${isGrowth ? 'text-orange-500' : 'text-emerald-500'}`} />
                        {feature}
                      </li>
                    ))}
                    {(plan.unavailable || []).map((feature) => (
                      <li key={feature} className="flex items-start gap-3 text-sm font-semibold leading-6 text-slate-400 line-through decoration-slate-300">
                        <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`mt-auto border-t p-6 ${isGrowth ? 'border-orange-100 bg-orange-50' : 'border-slate-100 bg-slate-50'}`}>
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.id)}
                    disabled={isLoading}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${
                      isGrowth ? 'bg-orange-500 shadow-orange-200 hover:bg-orange-600' : 'bg-[#13233f] shadow-slate-200 hover:bg-[#071020]'
                    }`}
                  >
                    {isLoading ? 'Opening Checkout...' : plan.cta}
                    {!isLoading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-7xl">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Plan Breakdown</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#071020]">What each clinic plan includes</h2>
            </div>
            <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500">
              Aap quickly compare kar sakte hain ki Starter me kya missing hai, Growth me kya unlock hota hai, aur Multi-Specialty kis clinic ke liye best hai.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[900px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 text-xs font-black uppercase tracking-widest text-[#13233f]">
                  <th className="px-5 py-4">Feature</th>
                  <th className="px-5 py-4">Starter Clinic</th>
                  <th className="border-x border-orange-200 bg-orange-50 px-5 py-4 text-orange-700">Growth Clinic</th>
                  <th className="px-5 py-4">Multi-Specialty</th>
                </tr>
              </thead>
              <tbody>
                {PLAN_BREAKDOWN_ROWS.map(([feature, starter, growth, multi]) => (
                  <tr key={feature} className="border-t border-slate-100">
                    <td className="px-5 py-4 text-sm font-black text-[#071020]">{feature}</td>
                    <td className={`px-5 py-4 text-sm font-bold ${String(starter).includes('Not included') ? 'text-rose-500' : 'text-slate-600'}`}>
                      {String(starter).includes('Not included') ? <X className="mr-2 inline h-4 w-4" /> : <Check className="mr-2 inline h-4 w-4 text-emerald-500" />}
                      {starter}
                    </td>
                    <td className="border-x border-orange-100 bg-orange-50/50 px-5 py-4 text-sm font-black text-[#071020]">
                      <Check className="mr-2 inline h-4 w-4 text-orange-500" />
                      {growth}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-slate-600">
                      <Check className="mr-2 inline h-4 w-4 text-emerald-500" />
                      {multi}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#13233f]">Market Comparison</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#071020]">YogiDesk AI against common alternatives</h2>
          </div>
          <p className="max-w-xl text-sm font-semibold leading-6 text-slate-500">Scroll horizontally on smaller screens. The YogiDesk AI column uses a premium navy highlight with orange confirmation markers.</p>
        </div>
        <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[860px] w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#071020] text-xs font-black uppercase tracking-widest text-white">
                <th className="px-5 py-4">Feature</th>
                <th className="px-5 py-4">WATI / Interakt</th>
                <th className="px-5 py-4">Twilio</th>
                <th className="border-l-4 border-orange-500 bg-[#1d3b63] px-5 py-4">YogiDesk AI</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(([feature, wati, twilio, yogi]) => (
                <tr key={feature} className="border-t border-slate-100">
                  <td className="px-5 py-5 text-sm font-black text-[#071020]">{feature}</td>
                  <td className="px-5 py-5 text-sm font-bold text-slate-500">{wati}</td>
                  <td className="px-5 py-5 text-sm font-bold text-slate-500">{twilio}</td>
                  <td className="border-l-4 border-orange-500 bg-slate-100 px-5 py-5 text-sm font-black text-[#071020]">
                    <span className="inline-flex items-center gap-2">
                      <Check className="h-4 w-4 rounded-full border border-orange-400 text-orange-500" />
                      {yogi}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-7xl gap-6 lg:grid-cols-[1.5fr_0.8fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Clinic ROI Calculator</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-[#071020]">Calculate Your Clinic&apos;s Savings</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">Move the slider to estimate monthly savings against common platform costs.</p>

          <div className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <label htmlFor="message-volume" className="text-sm font-black text-[#071020]">Monthly Message Volume</label>
              <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-orange-600">{messageVolume.toLocaleString('en-IN')} msgs</span>
            </div>
            <input
              id="message-volume"
              type="range"
              min="500"
              max="20000"
              step="100"
              value={messageVolume}
              onChange={(event) => setMessageVolume(Number(event.target.value))}
              style={{
                background: `linear-gradient(to right, #ff6b00 0%, #ff6b00 ${getSliderProgress(messageVolume)}%, #334155 ${getSliderProgress(messageVolume)}%, #334155 100%)`,
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full accent-orange-500"
            />
            <div className="mt-3 flex justify-between text-xs font-black text-slate-400">
              <span>500</span>
              <span>20,000</span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-rose-500">WATI / Interakt Cost</p>
              <p className="mt-3 text-3xl font-black text-rose-600">{formatCurrency(roi.competitorCost)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-[#13233f]">YogiDesk Cost</p>
              <p className="mt-3 text-3xl font-black text-[#13233f]">{formatCurrency(roi.yogiDeskCost)}</p>
            </div>
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
              <p className="text-xs font-black uppercase tracking-widest text-orange-600">Estimated Savings</p>
              <p className="mt-3 text-3xl font-black text-orange-600">{formatCurrency(roi.savings)}</p>
            </div>
          </div>

          <div className="mt-6 rounded-[22px] bg-[#13233f] p-6 text-white">
            <p className="text-2xl font-black leading-snug">Your clinic can save {formatCurrency(roi.savings)} every month using YogiDesk AI</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">Based on {messageVolume.toLocaleString('en-IN')} messages per month and the selected workspace pricing model.</p>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#071020]">Plan quick pick</h3>
              <p className="text-sm font-semibold text-slate-500">Checkout with the active duration</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {PLAN_CARDS.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={loadingPlanId === `${plan.id}_${durationId}`}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                  plan.id === 'growth' ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <span>
                  <span className="block text-sm font-black text-[#071020]">{plan.title}</span>
                  <span className="mt-1 block text-sm font-bold text-slate-500">Rs. {prices[plan.id]}/month</span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${plan.id === 'growth' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {loadingPlanId === `${plan.id}_${durationId}` ? 'Opening' : 'Checkout'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-7xl gap-6 lg:grid-cols-[0.8fr_1.6fr]">
        <div className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-slate-100 p-7 text-[#071020] shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-3xl font-black leading-tight">Medical Security & Compliance</h2>
          <div className="mt-6 space-y-3">
            {SECURITY_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Icon className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-black">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#13233f]">Zero-Effort Setup Path</p>
              <h2 className="mt-3 text-3xl font-black text-[#071020]">Go live in three guided steps</h2>
            </div>
            <Stethoscope className="hidden h-9 w-9 text-[#13233f] sm:block" />
          </div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {SETUP_STEPS.map(([step, title, body]) => (
              <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#13233f] text-sm font-black text-white">{step}</span>
                  <ArrowRight className="h-5 w-5 text-orange-500" />
                </div>
                <h3 className="mt-5 text-lg font-black leading-7 text-[#071020]">{title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Decision Helper</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[#071020]">Kaunsa plan choose karein?</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                Agar clinic me daily patient follow-up, staff coordination, ya automated replies ki need hai, Growth plan best starting point hai. Starter sirf reminders ke liye, aur Multi-Specialty high-volume multi-doctor teams ke liye hai.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ['Starter', 'Basic reminders aur templates chahiye. AI assistant nahi chahiye.'],
                ['Growth', 'Staff inbox, AI assistant, reports, reviews aur takeover controls chahiye.'],
                ['Multi-Specialty', 'Multiple doctors, locations aur advanced patient routing chahiye.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <UserCheck className="h-5 w-5 text-orange-500" />
                  <h3 className="mt-4 text-base font-black text-[#071020]">{title}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-[#13233f]">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#13233f]">Doctor Questions</p>
              <h2 className="text-3xl font-black text-[#071020]">Pricing FAQs</h2>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {FAQS.map((faq, index) => {
              const open = openFaq === index;
              return (
                <div key={faq.question} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <span className="text-base font-black text-[#071020]">{faq.question}</span>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${
                      open ? 'border-orange-300 bg-orange-50 text-orange-600' : 'border-slate-200 bg-white text-slate-500'
                    }`}>
                      <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {open && <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{faq.answer}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl rounded-[28px] bg-[#13233f] p-7 text-white shadow-sm sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-300">Ready for the smart desk upgrade?</p>
            <h2 className="mt-3 text-3xl font-black">Start with the plan that fits your clinic today.</h2>
          </div>
          <button
            type="button"
            onClick={() => handleCheckout('growth')}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-950/20 transition hover:bg-orange-600 active:scale-95"
          >
            Select Growth Plan
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {showLeadPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-[28px] border border-slate-100 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowLeadPopup(false)}
              className="absolute right-4 top-4 rounded-xl p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h4 className="text-xl font-black text-[#071020]">Still choosing the right plan?</h4>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              Share your clinic workflow and our team will help you pick the right automation scale.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowLeadPopup(false)}
                className="w-full rounded-xl bg-slate-100 px-4 py-2.5 font-bold text-slate-700 transition hover:bg-slate-200 sm:w-1/2"
              >
                Explore More
              </button>
              <a
                href="https://wa.me/919876543210"
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2.5 text-center font-bold text-white shadow-sm transition hover:bg-orange-600 sm:w-1/2"
              >
                Let&apos;s Connect <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
