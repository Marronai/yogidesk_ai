import React, { useMemo, useState, useEffect } from 'react';
import {
  ArrowRight,
  Check,
  X,
  Bot,
  Zap,
  MessageSquare,
  ShieldCheck,
  Radio,
  ToggleRight,
  Wrench,
} from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import PublicNavbar from '../components/PublicNavbar';
import api from '../utils/api';

const DURATIONS = [
  { id: '3m', label: '3 Months', saving: 'Starter cycle', months: 3 },
  { id: '6m', label: '6 Months', saving: 'Save 15%', months: 6 },
  { id: '12m', label: '1 Year', saving: 'Save 30%', months: 12 },
];

const BASE_PRICES = {
  '3m': { starter: 199, growth: 399, multi: 799 },
  '6m': { starter: 169, growth: 339, multi: 679 },
  '12m': { starter: 139, growth: 279, multi: 559 },
};

const PLANS = [
  {
    id: 'starter',
    name: 'Starter Clinic',
    audience: 'For solo doctors getting automated reminders live.',
    features: ['500 patients', 'Standard reminders', '50+ medical templates', 'Single workspace admin'],
  },
  {
    id: 'growth',
    name: 'Growth Clinic',
    audience: 'For growing clinics with front desk collaboration.',
    features: ['2,000 patients', 'Admin + 2 staff seats', 'Shared team inbox', 'Priority onboarding'],
    popular: true,
  },
  {
    id: 'multi',
    name: 'Multi-Specialty',
    audience: 'For larger clinics and hospital teams.',
    features: ['Unlimited patients', 'Admin + 10 staff seats', 'Priority API access', 'Dedicated support routing'],
  },
];

const TRUST_DETAILS = [
  { icon: ShieldCheck, text: 'Enterprise-Grade Client Protocol Isolation (100% Secure)' },
  { icon: Radio, text: 'Omnichannel 24/7 Smart Desk Automated Response Execution' },
  { icon: ToggleRight, text: 'Human-Takeover Toggle Switch Overrides Enabled Instantly' },
  { icon: Wrench, text: 'Zero Network Maintenance Overheads' },
];

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
  const [showLeadPopup, setShowLeadPopup] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [loadingPlanId, setLoadingPlanId] = useState('');

  // 5-Minute Behavioral Timeout Popup Trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLeadPopup(true);
    }, 5 * 60 * 1000); // Fires strictly after 5 minutes of dwell time
    return () => clearTimeout(timer);
  }, []);

  const prices = useMemo(() => BASE_PRICES[durationId] || BASE_PRICES['12m'], [durationId]);

  const handleCheckout = async (planId, price) => {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const userId = user?.id || localStorage.getItem('user_id');
      if (!userId) {
        window.location.href = '/signup';
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
        description: order.planName || `Workspace plan at Rs. ${price}/month`,
        order_id: order.order_id,
        prefill: {
          name: user?.user_metadata?.full_name || localStorage.getItem('user_name') || 'Doctor',
          email: user?.email || localStorage.getItem('user_email') || '',
        },
        notes: {
          plan_id: securePlanId,
        },
        theme: {
          color: '#13233f',
        },
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
    } finally {
      if (!window.Razorpay) setLoadingPlanId('');
    }
  };

  return (
    <div className="relative bg-slate-50 py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <PublicNavbar />
      
      {/* HEADER */}
      <div className="mx-auto mb-12 max-w-7xl pt-20">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="p-8 sm:p-10 lg:p-12">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-600">Workspace Pricing</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Simple, Transparent Workspace Plans
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-slate-600">
                Choose the perfect automation scale for your clinic. No hidden engine setup fees.
              </p>
            </div>
            <div className="bg-[#071020] p-8 text-white sm:p-10 lg:p-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-orange-300">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-8 text-2xl font-black leading-tight">Medical workspace billing with secure plan activation</h2>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
                Plans are validated server-side before checkout, keeping subscription activation clean and tamper-resistant.
              </p>
            </div>
          </div>
        </div>
      </div>

      {checkoutStatus && (
        <div className={`mx-auto mb-8 max-w-7xl rounded-2xl border px-5 py-4 text-sm font-bold shadow-sm ${
          checkoutStatus.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-red-200 bg-red-50 text-red-800'
        }`}>
          {checkoutStatus.text}
        </div>
      )}

      {/* DURATION SELECTOR */}
      <div className="max-w-7xl mx-auto mb-12 flex justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-slate-200 p-2 border border-slate-300">
          {DURATIONS.map((item) => {
            const active = durationId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDurationId(item.id)}
                className={`rounded-xl px-5 py-3 text-left sm:text-center transition border ${active ? 'bg-orange-500 border-orange-500 text-white shadow-lg' : 'bg-white border-slate-300 text-slate-700 hover:border-orange-300'}`}
              >
                <span className="block text-sm font-bold">{item.label}</span>
                <span className={`block text-xs font-bold mt-0.5 ${active ? 'text-orange-100' : 'text-slate-500'}`}>{item.saving}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* THREE-COLUMN ROW MATRIX */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 gap-8 lg:grid-cols-3 items-start">
        
        {/* ================= PLAN 1: STARTER ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-6 sm:p-8">
            <h3 className="text-2xl font-bold text-slate-900">Starter</h3>
            <div className="mt-4 flex items-baseline text-slate-900">
              <span className="text-4xl font-extrabold tracking-tight">₹{prices.starter}</span>
              <span className="ml-1 text-xl font-semibold text-slate-500">/mo</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Perfect for solo practitioners starting digital automation.</p>
            
            {/* COLLAPSIBLE ACCORDION CONTAINER FOR FEATURES */}
            <div className="mt-6 max-h-[420px] overflow-y-auto pr-2 border-t border-slate-100 pt-4">
              <ul className="space-y-4">
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Database of 500 patients
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> 50+ doctor-specific WhatsApp templates
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Hindi + Hinglish + English templates
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Appointment reminder automation
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Single workspace (solo doctor)
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Basic broadcast bulk of patients
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Message delay protection (no block)
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Basic message analytics
                </li>
                <li className="flex items-start text-emerald-600 font-medium text-sm">
                  <Zap className="h-5 w-5 text-amber-500 mr-2 shrink-0 mt-0.5 animate-pulse" /> 50 free credits on signup
                </li>
                {/* STRICT UNAVAILABLE BOUNDS */}
                {['Staff/receptionist seats', 'Shared team inbox (multi-agent)', 'Ghost Mode (private notes to staff)', 'AI Bot (auto appointment booking)', 'Google Review automation', 'PDF/Lab report delivery'].map((f) => (
                  <li key={f} className="flex items-start text-sm text-slate-400 line-through decoration-slate-300">
                    <X className="h-5 w-5 text-rose-400 mr-2 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">
            <button onClick={() => handleCheckout('starter', prices.starter)} disabled={loadingPlanId === `starter_${durationId}`} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 disabled:cursor-not-allowed disabled:opacity-70">
              {loadingPlanId === `starter_${durationId}` ? 'Opening Checkout...' : 'Choose Plan'}
            </button>
          </div>
        </div>

        {/* ================= PLAN 2: GROWTH (MOST POPULAR) ================= */}
        <div className="bg-white rounded-2xl border-2 border-orange-500 shadow-md flex flex-col justify-between overflow-hidden relative transform lg:-translate-y-2">
          <div className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-bl-xl uppercase tracking-wider">
            Most Popular
          </div>
          <div className="p-6 sm:p-8">
            <h3 className="text-2xl font-bold text-slate-900">Growth</h3>
            <div className="mt-4 flex items-baseline text-slate-900">
              <span className="text-4xl font-extrabold tracking-tight">₹{prices.growth}</span>
              <span className="ml-1 text-xl font-semibold text-slate-500">/mo</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Everything in Starter, engineered to scale growing medical practices.</p>
            
            {/* HIGHLIGHTED CATCHY INSIGHT */}
            <div className="mt-4 bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-start">
              <Bot className="h-5 w-5 text-orange-500 mr-2 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wide">🤖 AI Appointment Bot Included!</p>
                <p className="text-xs text-orange-700 mt-0.5">Patient se khud baat karta hai, appointment book karta hai — bina receptionist ke. 24/7 available.</p>
              </div>
            </div>

            {/* SCROLLABLE FEATURE LIST */}
            <div className="mt-4 max-h-[340px] overflow-y-auto pr-2 border-t border-slate-100 pt-4">
              <ul className="space-y-4">
                <li className="flex items-start text-sm text-slate-700 font-semibold">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Everything in Starter Included
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Database of 2,000 patients
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Admin + 2 staff seats (receptionist config)
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> 200+ specialization templates (dentist, GP, cardio, etc.)
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Shared Team Inbox (Conversations in One Place)
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Ghost Mode (Send private notes to the staff; patient won't see)
                </li>
                <li className="flex items-start text-sm font-medium text-orange-600">
                  <Check className="h-5 w-5 text-orange-500 mr-2 shrink-0 mt-0.5" /> AI Bot appointment booking & auto-reply
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> PDF / Lab Report Send via WhatsApp
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Google Review collection automation
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Advanced broadcast analytics
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Priority Onboarding setup team help
                </li>
                <li className="flex items-start text-sm text-slate-400 font-medium">
                  <Zap className="h-5 w-5 text-slate-300 mr-2 shrink-0 mt-0.5" /> Meta Ads integration (coming soon)
                </li>
              </ul>
            </div>
          </div>
          <div className="p-6 bg-orange-50 border-t border-orange-100 mt-auto">
            <button onClick={() => handleCheckout('growth', prices.growth)} disabled={loadingPlanId === `growth_${durationId}`} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition duration-200 disabled:cursor-not-allowed disabled:opacity-70">
              {loadingPlanId === `growth_${durationId}` ? 'Opening Checkout...' : 'Select Plan'}
            </button>
          </div>
        </div>

        {/* ================= PLAN 3: MULTI-SPECIALTY ================= */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-6 sm:p-8">
            <h3 className="text-2xl font-bold text-slate-900">Multi-Specialty</h3>
            <div className="mt-4 flex items-baseline text-slate-900">
              <span className="text-4xl font-extrabold tracking-tight">₹{prices.multi}</span>
              <span className="ml-1 text-xl font-semibold text-slate-500">/mo</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Everything in Growth, tailored for multi-doctor clinics and advanced intelligence.</p>
            
            {/* HIGHLIGHTED ADVANCED BOT INSIGHT */}
            <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-start">
              <Zap className="h-5 w-5 text-indigo-600 mr-2 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide">⚡ Advanced AI Bot — Multi-Specialty</p>
                <p className="text-xs text-indigo-700 mt-0.5">Alag specializations ke liye alag bot flows. Ek patient dentist ke liye, doosra GP ke liye — sab automatically route.</p>
              </div>
            </div>

            {/* SCROLLABLE FEATURE LIST */}
            <div className="mt-4 max-h-[340px] overflow-y-auto pr-2 border-t border-slate-100 pt-4">
              <ul className="space-y-4">
                <li className="flex items-start text-sm text-slate-700 font-semibold">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Everything in Growth Included
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Database of 10,000 patients
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Admin + 5 staff seats
                </li>
                <li className="flex items-start text-sm font-medium text-indigo-600">
                  <Check className="h-5 w-5 text-indigo-500 mr-2 shrink-0 mt-0.5" /> Specialty-wise advanced patient bot routing
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Multi-doctor + multi-location management
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Custom template by building a library
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Revenue analytics & ROI tracking
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Priority API Access For Integrations
                </li>
                <li className="flex items-start text-sm text-slate-700">
                  <Check className="h-5 w-5 text-emerald-500 mr-2 shrink-0 mt-0.5" /> Dedicated Onboarding Manager & Support
                </li>
              </ul>
            </div>
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">
            <button onClick={() => handleCheckout('multi', prices.multi)} disabled={loadingPlanId === `multi_${durationId}`} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 disabled:cursor-not-allowed disabled:opacity-70">
              {loadingPlanId === `multi_${durationId}` ? 'Opening Checkout...' : 'Choose Plan'}
            </button>
          </div>
        </div>

      </div>

      <section className="mx-auto mt-10 max-w-7xl">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {TRUST_DETAILS.map(({ icon: Icon, text }) => (
              <div key={text} className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-black leading-6 text-[#13233f]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 5-MINUTE DWELL OVERLAY POPUP ================= */}
      {showLeadPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowLeadPopup(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-orange-100 text-orange-600 mb-4">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h4 className="text-xl font-bold text-slate-900">Still confused about choosing a plan?</h4>
            <p className="mt-2 text-sm text-slate-600">
              Don't worry! Tell us your clinic workflow metrics and our medical automation experts will guide you to the absolute perfect roadmap configuration.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setShowLeadPopup(false)}
                className="w-full sm:w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl transition"
              >
                Explore More
              </button>
              <a 
                href="https://wa.me/919876543210" 
                target="_blank" 
                rel="noreferrer"
                className="w-full sm:w-1/2 bg-orange-500 hover:bg-orange-600 text-white text-center font-semibold py-2.5 px-4 rounded-xl inline-flex items-center justify-center gap-1.5 shadow-sm transition"
              >
                Let's Connect <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
