import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  FileText,
  Menu,
  QrCode,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';

const ORANGE = '#FF6A00';
const SUCCESS = '#00A389';

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
  ['Marketing broadcast cost', '~₹1.50 - ₹2.50/msg', '~₹1.80 - ₹2.20/msg', '₹0.90/msg'],
  ['Setup ease', 'Complex', 'Developer required', '1-click doctor workspace'],
  ['Clinic support', 'Generic queue', 'Engineering-led', 'Healthcare-focused onboarding'],
];

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
  const selectedTier = selectedPlan === 'multi' ? 'MULTI_SPECIALTY' : selectedPlan === 'starter' ? 'STARTER' : 'GROWTH';
  const selectedPlanTotal = selectedPlanPrice * months;

  const openSubscriptionCheckout = async () => {
    try {
      setCheckoutLoading(true);
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const userId = user?.id || localStorage.getItem('user_id');
      const email = user?.email || localStorage.getItem('user_email') || '';
      const firstname = user?.user_metadata?.full_name || localStorage.getItem('user_name') || 'Yogi Desk User';
      const phone = user?.user_metadata?.phone || localStorage.getItem('user_phone') || '';

      if (!userId || !email) {
        window.location.href = '/signup';
        return;
      }

      const response = await api.post('/payments/initiate-payu', {
        userId,
        amount: selectedPlanTotal,
        firstname,
        email,
        phone,
        purpose: 'subscription',
        tier: selectedTier,
      });

      const payuPayload = response.data?.payload;
      if (!response.data?.success || !payuPayload?.hash) throw new Error(response.data?.msg || 'Unable to open subscription checkout.');

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = response.data.checkoutUrl;
      form.target = '_self';
      form.style.display = 'none';

      Object.entries(payuPayload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        const field = document.createElement('input');
        field.type = 'hidden';
        field.name = key;
        field.value = String(value);
        form.appendChild(field);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      alert(error.message || 'Unable to start subscription checkout.');
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
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#00A389]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
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
                <span className="text-xs font-black uppercase tracking-widest text-[#00A389]">Market comparison</span>
                <h2 className="mt-2 text-3xl font-black text-slate-900">Yogi Desk against common alternatives</h2>
              </div>
              <p className="max-w-xl text-sm text-slate-500 font-medium">
                Scroll horizontally on smaller screens. The Yogi Desk column stays visually active with success accents.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="min-w-[760px] w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs uppercase tracking-wider">
                    <th className="px-5 py-4 font-black">Feature</th>
                    <th className="px-5 py-4 font-black">Wati / Interakt</th>
                    <th className="px-5 py-4 font-black">Twilio</th>
                    <th className="px-5 py-4 font-black bg-[#00A389]">Yogi Desk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {COMPARISON_ROWS.map(([feature, wati, twilio, yogi]) => (
                    <tr key={feature} className="bg-white">
                      <td className="px-5 py-4 font-black text-slate-900">{feature}</td>
                      <td className="px-5 py-4 text-slate-500 font-semibold">{wati}</td>
                      <td className="px-5 py-4 text-slate-500 font-semibold">{twilio}</td>
                      <td className="px-5 py-4 bg-emerald-50 text-slate-900 font-black border-l-4 border-[#00A389]">
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 size={17} className="text-[#00A389] shrink-0" />
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
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-[#00A389]">Yogi Desk cost</div>
                  <div className="mt-2 text-3xl font-black text-[#00A389]">₹{yogiCost.toLocaleString()}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">{selectedPlan.toUpperCase()} plan</div>
                </div>
                <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                  <div className="text-xs font-black uppercase tracking-widest text-[#FF6A00]">Estimated savings</div>
                  <div className="mt-2 text-3xl font-black text-[#FF6A00]">₹{savings.toLocaleString()}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">vs competitor</div>
                </div>
              </div>

              <div className="mt-7 rounded-2xl bg-[#00A389] p-5 sm:p-6 text-white">
                <div className="text-2xl sm:text-3xl font-black leading-tight">
                  Dr. {displayName}, you save ₹{savings.toLocaleString()} using Yogi Desk over {periodLabel}
                </div>
                <p className="mt-3 text-sm font-semibold text-emerald-50">
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
      </main>
    </div>
  );
}
