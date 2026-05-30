import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Database,
  FileText,
  Lock,
  Menu,
  MessageCircle,
  QrCode,
  Settings,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';

const resourceLinks = [
  { name: 'ROI Calculator', icon: <Calculator size={16} />, link: '/calculator' },
  { name: 'API Docs', icon: <FileText size={16} />, link: '/docs' },
  { name: 'QR Generator', icon: <QrCode size={16} />, link: '/qr-generator' },
  { name: 'Setup Docs', icon: <Settings size={16} />, link: '/setup' },
];

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

const COMPARISON_ROWS = [
  ['Platform subscription', '₹2,499/mo', 'API only', 'From ₹139/mo'],
  ['Utility reminders cost', '~₹1.50 - ₹2.50/msg', '~₹1.80 - ₹2.20/msg', '₹0.20/msg'],
  ['Marketing broadcast cost', '~₹1.50 - ₹2.50/msg', '~₹1.80 - ₹2.20/msg', '₹1.30/msg'],
  ['Setup ease', 'Complex', 'Developer required', '1-click doctor workspace'],
  ['Clinic support', 'Generic queue', 'Engineering-led', 'Healthcare-focused onboarding'],
  ['Official Green Tick Support', 'Extra Fees / Setup Help Missing', 'Self-managed API', 'Guided Application Included'],
  ['Staff Seat Concurrency', 'Charges Per Additional Agent', 'Developer-built custom routing', 'Multi-Agent Dashboard Access'],
  ['Clinic AI Flow Bot Setup', 'Complex Flow-builder Coding', 'No Native Bot Layer', '1-Click Patient Smart Assistant'],
];

const FAQS = [
  {
    question: 'Can I reuse my existing clinic clinic number?',
    answer: 'Yes. If your number is eligible for WhatsApp Business API migration, our onboarding team guides the Meta verification and number connection steps without disturbing your patient records.',
  },
  {
    question: 'How does the Meta approval loop work?',
    answer: 'You create or select medical templates inside Yogi Desk, submit them to Meta for review, and track approval status from the workspace. Approved templates can then be used for reminders, lab reports, and campaigns.',
  },
  {
    question: 'Is my data completely secure?',
    answer: 'Patient databases, campaign logs, wallet records, and Meta credentials remain separated by workspace. Subscription upgrades only update access limits and never wipe operational rows.',
  },
];

const TRUST_BADGES = [
  { icon: Lock, title: 'HIPAA Compliant Storage Layouts' },
  { icon: Database, title: '100% Patient Database Separation' },
  { icon: ShieldCheck, title: 'End-to-End Meta API Encryption' },
];

const SETUP_STEPS = [
  { title: 'Choose Your Duration Plan', detail: 'Select the plan and tenure that fits your clinic workflow.' },
  { title: 'Connect Your Verified WhatsApp Number', detail: 'Link Meta credentials with guided setup support.' },
  { title: 'Run Automated Reminders', detail: 'Launch appointment, lab report, and follow-up journeys.' },
];

const loadRazorpayScript = () => new Promise((resolve, reject) => {
  if (window.Razorpay) {
    resolve(true);
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.onload = () => resolve(true);
  script.onerror = () => reject(new Error('Unable to load Razorpay checkout.'));
  document.body.appendChild(script);
});

function MarketingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResourceOpen, setIsResourceOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#FF6A00] rounded-xl flex items-center justify-center shadow-lg shadow-orange-200 text-white font-extrabold text-xl">
            Y
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">
            Yogi Desk <span className="text-blue-600">AI</span>
          </span>
        </Link>

        <div className="hidden md:flex gap-8 text-sm font-bold text-slate-600 items-center">
          <Link to="/" className="hover:text-[#FF6A00] transition">Home</Link>
          <Link to="/about" className="hover:text-[#FF6A00] transition">About Us</Link>
          <div
            className="relative"
            onMouseEnter={() => setIsResourceOpen(true)}
            onMouseLeave={() => setIsResourceOpen(false)}
          >
            <button className="flex items-center gap-1 hover:text-[#FF6A00] transition py-4">
              Resources <ChevronDown size={14} />
            </button>
            <div className={`absolute top-full left-0 w-56 bg-white border border-gray-100 shadow-xl rounded-xl p-2 transition-all duration-200 origin-top ${isResourceOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
              {resourceLinks.map((item) => (
                <Link key={item.name} to={item.link} className="flex items-center gap-3 p-3 hover:bg-orange-50 rounded-lg text-slate-600 hover:text-[#FF6A00] transition">
                  {item.icon}
                  <span className="font-semibold">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
          <Link to="/pricing" className="text-[#FF6A00] transition">Pricing</Link>
          <Link to="/contact" className="hover:text-[#FF6A00] transition">Contact Us</Link>
        </div>

        <div className="hidden md:flex gap-4 items-center">
          <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#FF6A00] transition">Log In</Link>
          <Link to="/signup" className="bg-[#FF6A00] hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-orange-200 flex items-center gap-2 transform hover:-translate-y-0.5">
            Get Started <ArrowRight size={16} />
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden p-2 text-slate-900 hover:text-[#FF6A00]"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-100 px-6 py-4 space-y-3 flex flex-col font-bold text-slate-600 text-sm">
          <Link to="/" onClick={closeMenu} className="hover:text-[#FF6A00] py-2">Home</Link>
          <Link to="/about" onClick={closeMenu} className="hover:text-[#FF6A00] py-2">About Us</Link>
          <div className="pt-2">
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Resources</div>
            <div className="grid grid-cols-1 gap-1">
              {resourceLinks.map((item) => (
                <Link key={item.name} to={item.link} onClick={closeMenu} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-orange-50 hover:text-[#FF6A00]">
                  {item.icon}
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <Link to="/pricing" onClick={closeMenu} className="text-[#FF6A00] py-2">Pricing</Link>
          <Link to="/contact" onClick={closeMenu} className="hover:text-[#FF6A00] py-2">Contact Us</Link>
          <hr className="border-gray-100" />
          <Link to="/login" onClick={closeMenu} className="hover:text-[#FF6A00] py-2">Log In</Link>
          <Link to="/signup" onClick={closeMenu} className="bg-[#FF6A00] text-white text-center py-3 rounded-xl shadow-md">
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}

export default function Pricing() {
  const [durationId, setDurationId] = useState('12m');
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [sliderValue, setSliderValue] = useState(2000);
  const [doctorName, setDoctorName] = useState('Doctor');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const duration = useMemo(() => DURATIONS.find((d) => d.id === durationId) || DURATIONS[0], [durationId]);
  const prices = useMemo(() => BASE_PRICES[durationId] || BASE_PRICES['12m'], [durationId]);

  const competitorSubMonthly = 2499;
  const competitorMsgRate = 2.2;
  const yogiMsgRate = 0.55;
  const months = duration.months;
  const selectedPlanPrice = prices[selectedPlan] || prices.growth;
  const competitorCost = Math.round((sliderValue * competitorMsgRate * months) + (competitorSubMonthly * months));
  const yogiCost = Math.round((sliderValue * yogiMsgRate * months) + (selectedPlanPrice * months));
  const savings = Math.max(0, competitorCost - yogiCost);
  const periodLabel = months === 12 ? '1 Year' : `${months} Months`;
  const displayName = doctorName.trim() || 'Doctor';
  const selectedPlanLabel = PLANS.find((plan) => plan.id === selectedPlan)?.name || 'Growth Clinic';

  const getPlanMeta = (planId = selectedPlan) => {
    const plan = PLANS.find((item) => item.id === planId) || PLANS[1];
    const tier = plan.id === 'multi' ? 'MULTI_SPECIALTY' : plan.id === 'starter' ? 'STARTER' : 'GROWTH';
    const monthlyPrice = prices[plan.id] || prices.growth;
    return {
      plan,
      tier,
      total: monthlyPrice * months,
    };
  };

  const verifySubscriptionPayment = async ({ response, userId, tier, amount }) => {
    const { data } = await api.post('/payments/verify-razorpay-subscription', {
      userId,
      tier,
      amount,
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    });
    return data;
  };

  const openSubscriptionCheckout = async (planId = selectedPlan) => {
    try {
      setCheckoutLoading(true);
      setSelectedPlan(planId);
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const userId = user?.id || localStorage.getItem('user_id');
      const email = user?.email || localStorage.getItem('user_email') || '';
      const firstname = user?.user_metadata?.full_name || localStorage.getItem('user_name') || 'Yogi Desk User';
      const phone = user?.user_metadata?.phone || localStorage.getItem('user_phone') || '';
      const { plan, tier, total } = getPlanMeta(planId);
      const amountPaise = Math.round(total * 100);

      if (!userId || !email) {
        window.location.href = '/signup';
        return;
      }

      await loadRazorpayScript();

      const response = await api.post('/payments/razorpay-subscription-session', {
        userId,
        tier,
        planName: plan.name,
        amountPaise,
        email,
      });

      if (!response.data?.success || !response.data?.order?.id) {
        throw new Error(response.data?.msg || 'Unable to open Razorpay checkout.');
      }

      const razorpayOptions = {
        key: response.data.key,
        amount: amountPaise,
        currency: 'INR',
        name: 'Yogi Desk AI',
        description: `Upgrading to ${plan.name} Package`,
        order_id: response.data.order.id,
        prefill: { email, name: firstname, contact: phone },
        theme: { color: '#FF6A00' },
        handler: async function (razorpayResponse) {
          const updateStatus = await verifySubscriptionPayment({
            response: razorpayResponse,
            userId,
            tier,
            amount: total,
          });
          if (updateStatus.success) window.location.reload();
        },
        modal: {
          ondismiss: () => setCheckoutLoading(false),
        },
      };

      const paymentWindow = new window.Razorpay(razorpayOptions);
      paymentWindow.open();
    } catch (error) {
      alert(error.message || 'Unable to start Razorpay subscription checkout.');
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-[#FF6A00] selection:text-white antialiased">
      <MarketingHeader />

      <main className="pt-32 sm:pt-36">
        <section className="px-4 sm:px-6 pb-10">
          <div className="max-w-7xl mx-auto text-center">
            <span className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 px-4 py-1.5 rounded-full text-xs font-black text-[#FF6A00] uppercase tracking-wider">
              Transparent Clinic Pricing
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Pricing built for doctors, not generic broadcast teams.
            </h1>
            <p className="mt-5 max-w-3xl mx-auto text-base sm:text-lg text-slate-500 font-medium leading-relaxed">
              Pick a clinic tier, choose your billing duration, and estimate what Yogi Desk saves against common WhatsApp automation providers.
            </p>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-center mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2 border border-slate-100">
                {DURATIONS.map((item) => {
                  const active = durationId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDurationId(item.id)}
                      className={`rounded-xl px-5 py-3 text-left sm:text-center transition border ${active ? 'bg-[#FF6A00] border-[#FF6A00] text-white shadow-lg shadow-orange-200' : 'bg-white border-slate-100 text-slate-700 hover:border-orange-200'}`}
                    >
                      <span className="block text-sm font-black">{item.label}</span>
                      <span className={`block text-xs font-bold mt-0.5 ${active ? 'text-orange-50' : 'text-slate-400'}`}>{item.saving}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {PLANS.map((plan) => {
                const selected = selectedPlan === plan.id;
                return (
                  <article
                    key={plan.id}
                    className={`relative rounded-2xl p-6 border bg-white transition ${plan.popular ? 'border-[#FF6A00] ring-4 ring-orange-100' : 'border-gray-200 hover:border-orange-200'} ${selected ? 'shadow-xl shadow-orange-100/70' : 'shadow-sm'}`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-5 bg-[#FF6A00] text-white text-[11px] px-3 py-1 rounded-full font-black tracking-wide">
                        MOST POPULAR - GROWTH CLINIC
                      </div>
                    )}
                    <div className="min-h-[118px]">
                      <h2 className="text-xl font-black text-slate-900">{plan.name}</h2>
                      <p className="mt-2 text-sm text-slate-500 leading-relaxed">{plan.audience}</p>
                    </div>

                    <div className="mt-5 flex items-end gap-1">
                      <span className="text-4xl font-black tracking-tight">₹{prices[plan.id]}</span>
                      <span className="pb-1 text-sm font-bold text-slate-500">/month</span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-slate-400">Billed for {periodLabel}</p>

                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm font-semibold text-slate-700">
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#FF6A00]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => openSubscriptionCheckout(plan.id)}
                      className={`mt-7 w-full rounded-xl px-4 py-3 text-sm font-black transition ${selected ? 'bg-[#FF6A00] text-white shadow-lg shadow-orange-200' : 'bg-slate-900 text-white hover:bg-[#FF6A00]'}`}
                    >
                      {selected ? 'Selected Plan' : 'Choose Plan'}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-12 bg-gray-50/70 border-y border-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-[#1E3A5F]">Market comparison</span>
                <h2 className="mt-2 text-3xl font-black text-slate-900">Yogi Desk against common alternatives</h2>
              </div>
              <p className="max-w-xl text-sm text-slate-500 font-medium">
                Scroll horizontally on smaller screens. The Yogi Desk column uses a premium slate highlight with orange confirmation markers.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="min-w-[760px] w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                    <th className="px-5 py-4 font-black">Feature</th>
                    <th className="px-5 py-4 font-black">Wati / Interakt</th>
                    <th className="px-5 py-4 font-black">Twilio</th>
                    <th className="px-5 py-4 font-black bg-[#1E3A5F]">Yogi Desk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {COMPARISON_ROWS.map(([feature, wati, twilio, yogi]) => (
                    <tr key={feature} className="bg-white">
                      <td className="px-5 py-4 font-black text-slate-900">{feature}</td>
                      <td className="px-5 py-4 text-slate-500 font-semibold">{wati}</td>
                      <td className="px-5 py-4 text-slate-500 font-semibold">{twilio}</td>
                      <td className="px-5 py-4 bg-slate-100 text-slate-950 font-black border-l-4 border-[#1E3A5F]">
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 size={17} className="text-[#FF6A00] shrink-0" />
                          {yogi}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                <div>
                  <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#FF6A00]">
                    <Calculator size={16} /> Exval Registered Calculator
                  </span>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">ROI savings slider</h2>
                  <p className="mt-2 text-sm text-slate-500 font-medium">Duration and plan selections above update this estimate instantly.</p>
                </div>
                <label className="block sm:w-64">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Doctor name</span>
                  <input
                    value={doctorName}
                    onChange={(event) => setDoctorName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#FF6A00] focus:ring-4 focus:ring-orange-100"
                    placeholder="Doctor"
                  />
                </label>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor="message-volume" className="text-sm font-black text-slate-800">Monthly message volume</label>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-[#FF6A00]">{sliderValue.toLocaleString()} msgs</span>
                </div>
                <input
                  id="message-volume"
                  type="range"
                  min={500}
                  max={20000}
                  step={100}
                  value={sliderValue}
                  onChange={(event) => setSliderValue(Number(event.target.value))}
                  className="mt-5 w-full accent-[#FF6A00]"
                />
                <div className="mt-2 flex justify-between text-xs font-bold text-slate-400">
                  <span>500</span>
                  <span>20,000</span>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-rose-500">Competitor cost</div>
                  <div className="mt-2 text-3xl font-black text-rose-600">₹{competitorCost.toLocaleString()}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">for {periodLabel}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-[#1E3A5F]">Yogi Desk cost</div>
                  <div className="mt-2 text-3xl font-black text-[#1E3A5F]">₹{yogiCost.toLocaleString()}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">{selectedPlan.toUpperCase()} plan</div>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-[#FF6A00]">Estimated savings</div>
                  <div className="mt-2 text-3xl font-black text-[#FF6A00]">₹{savings.toLocaleString()}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">vs competitor</div>
                </div>
              </div>

              <div className="mt-7 rounded-2xl bg-[#14213D] p-5 sm:p-6 text-white ring-4 ring-slate-100">
                <div className="text-2xl sm:text-3xl font-black leading-tight">
                  Dr. {displayName}, you save ₹{savings.toLocaleString()} using Yogi Desk over {periodLabel}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-200">
                  Based on {sliderValue.toLocaleString()} messages per month, the {duration.label} billing duration, and the selected {selectedPlan.replace('-', ' ')} tier.
                </p>
              </div>
            </div>

            <aside className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#FF6A00] flex items-center justify-center">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Plan quick pick</h3>
                  <p className="text-xs font-semibold text-slate-400">Updates calculator totals</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {PLANS.map((plan) => {
                  const active = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`w-full rounded-xl border p-4 text-left transition ${active ? 'border-[#FF6A00] bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-black text-slate-900">{plan.name}</span>
                        <span className={`text-xs font-black rounded-full px-2.5 py-1 ${active ? 'bg-[#FF6A00] text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {active ? 'Active' : 'Select'}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-500">₹{prices[plan.id]}/month</div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={openSubscriptionCheckout}
                disabled={checkoutLoading}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutLoading ? 'Opening checkout...' : `Upgrade to ${selectedPlanLabel}`} <ArrowRight size={16} />
              </button>
            </aside>
          </div>
        </section>

        <section className="px-4 sm:px-6 pb-16">
          <div className="max-w-7xl mx-auto grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-[#1E3A5F]">
                  <MessageCircle size={22} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#1E3A5F]">Doctor Questions</p>
                  <h2 className="text-2xl font-black text-slate-950">Pricing FAQ</h2>
                </div>
              </div>

              <div className="mt-6 divide-y divide-slate-100">
                {FAQS.map((faq, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div key={faq.question} className="py-4">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? -1 : index)}
                        className="flex w-full items-center justify-between gap-4 text-left"
                      >
                        <span className="text-base font-black text-slate-900">{faq.question}</span>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm font-black transition ${isOpen ? 'border-[#FF6A00] bg-orange-50 text-[#FF6A00]' : 'border-slate-200 text-slate-500'}`}>
                          {isOpen ? '-' : '+'}
                        </span>
                      </button>
                      {isOpen && <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-500">{faq.answer}</p>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-orange-300">
                <ShieldCheck size={22} />
              </div>
              <h2 className="mt-4 text-2xl font-black">Medical Security & Compliance</h2>
              <div className="mt-5 grid gap-3">
                {TRUST_BADGES.map(({ icon, title }) => (
                  <div key={title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    {React.createElement(icon, { size: 18, className: 'shrink-0 text-orange-300' })}
                    <span className="text-sm font-bold text-slate-100">{title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6 lg:col-span-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#1E3A5F]">Setup Path</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Go live in three guided steps</h2>
                </div>
                <Stethoscope className="hidden text-[#1E3A5F] sm:block" size={30} />
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                {SETUP_STEPS.map((step, index) => (
                  <div key={step.title} className="relative rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#14213D] text-sm font-black text-white">
                      {index + 1}
                    </div>
                    <h3 className="mt-4 text-lg font-black text-slate-950">{step.title}</h3>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{step.detail}</p>
                    {index < SETUP_STEPS.length - 1 && (
                      <ArrowRight className="absolute right-5 top-6 hidden text-[#FF6A00] md:block" size={20} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
