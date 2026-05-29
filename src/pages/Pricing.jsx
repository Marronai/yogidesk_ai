import React, { useMemo, useState } from 'react';

const DURATIONS = [
  { id: '3m', label: '3 Months', months: 3 },
  { id: '6m', label: '6 Months (Save 15%)', months: 6 },
  { id: '12m', label: '1 Year (Save 30% - RECOMMENDED)', months: 12 },
];

const BASE_PRICES = {
  '3m': { starter: 199, growth: 399, multi: 799 },
  '6m': { starter: 169, growth: 339, multi: 679 },
  '12m': { starter: 139, growth: 279, multi: 559 },
};

const PLANS = [
  { id: 'starter', name: 'STARTER', features: ['500 Patients', 'Standard Reminders', '50+ Templates'] },
  { id: 'growth', name: 'GROWTH', features: ['2,000 Patients', 'Admin + 2 Staff', 'Shared Team Inbox'], popular: true },
  { id: 'multi', name: 'MULTI-SPECIALTY', features: ['Unlimited Patients', 'Admin + 10 Staff', 'Priority API Access'] },
];

export default function Pricing() {
  const [durationId, setDurationId] = useState('12m');
  const [selectedPlan, setSelectedPlan] = useState('growth');
  const [sliderValue, setSliderValue] = useState(2000);

  const duration = useMemo(() => DURATIONS.find((d) => d.id === durationId) || DURATIONS[0], [durationId]);
  const prices = useMemo(() => BASE_PRICES[durationId] || BASE_PRICES['12m'], [durationId]);

  const COMPETITOR_SUB_MONTHLY = 2499;
  const COMPETITOR_MSG_RATE = 2.2;
  const YOGI_MSG_RATE = 0.55;

  const months = duration.months;
  const selectedPlanPrice = prices[selectedPlan] || prices.growth;

  const competitorCost = Math.round((sliderValue * COMPETITOR_MSG_RATE * months) + (COMPETITOR_SUB_MONTHLY * months));
  const yogiCost = Math.round((sliderValue * YOGI_MSG_RATE * months) + (selectedPlanPrice * months));
  const savings = Math.max(0, competitorCost - yogiCost);
  const periodLabel = months >= 12 ? 'year' : `${months} months`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-md bg-emerald-500 flex items-center justify-center text-white font-bold">Y</div>
            <div className="text-sm font-semibold">Yogi Desk</div>
            <nav className="text-sm text-slate-600">Dashboard &gt; Subscription Management</nav>
          </div>
          <div>
            <button onClick={() => (window.location.href = '/dashboard')} className="inline-flex items-center gap-2 rounded-md bg-slate-900 text-white px-3 py-2 text-sm">Back to Workspace</button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto mt-8">
        <section className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Pricing & Plans</h1>
          <p className="text-slate-500 mt-2">Choose the right plan and lock in discounts for longer durations.</p>
        </section>

        <section className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-slate-100 p-1 shadow-sm">
            {DURATIONS.map((d) => (
              <button key={d.id} onClick={() => setDurationId(d.id)} className={`px-4 py-2 rounded-full text-sm font-semibold ${durationId === d.id ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}>
                {d.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`relative rounded-2xl p-6 border ${plan.popular ? 'border-emerald-300' : 'border-slate-200'} bg-white shadow-sm`}>
              {plan.popular && <div className="absolute -top-3 left-4 bg-amber-500 text-white text-xs px-3 py-1 rounded-full font-bold">Most Popular</div>}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{plan.popular ? 'Popular choice for growing clinics' : 'Designed for clinics'}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold">₹{prices[plan.id]}<span className="text-sm font-medium">/mo</span></div>
                  <div className="text-xs text-slate-500">billed {months} months</div>
                </div>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-slate-700">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3"><span className="text-emerald-500 mt-1">●</span><span>{f}</span></li>
                ))}
              </ul>
              <div className="mt-6">
                <button onClick={() => setSelectedPlan(plan.id)} className={`w-full rounded-md px-4 py-2 font-semibold ${selectedPlan === plan.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-900'}`}>{selectedPlan === plan.id ? 'Selected' : 'Choose Plan'}</button>
              </div>
            </div>
          ))}
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Competitor Comparison</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left rounded-xl border-separate border-spacing-0">
              <thead>
                <tr className="text-sm text-slate-500">
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">Wati / Interakt</th>
                  <th className="px-4 py-3">Twilio</th>
                  <th className="px-4 py-3">Yogi Desk</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-t border-slate-200 bg-white">
                  <td className="px-4 py-3 font-semibold">Platform Subscription</td>
                  <td className="px-4 py-3">₹2,499/mo</td>
                  <td className="px-4 py-3">API only</td>
                  <td className="px-4 py-3 border-l-4 border-emerald-400 bg-emerald-50 relative"><div className="absolute -left-3 -top-3 bg-emerald-600 text-white text-xs px-2 py-1 rounded">Most Cost-Effective</div><div className="font-semibold">₹139/mo</div></td>
                </tr>
                <tr className="border-t border-slate-200 bg-white"><td className="px-4 py-3 font-semibold">Utility Reminders Cost</td><td className="px-4 py-3">~₹1.50 - ₹2.50/msg</td><td className="px-4 py-3">~₹1.80 - ₹2.20/msg</td><td className="px-4 py-3 border-l-4 border-emerald-400 bg-emerald-50">₹0.20/msg</td></tr>
                <tr className="border-t border-slate-200 bg-white"><td className="px-4 py-3 font-semibold">Marketing Broadcast Cost</td><td className="px-4 py-3">~₹1.50 - ₹2.50/msg</td><td className="px-4 py-3">~₹1.80 - ₹2.20/msg</td><td className="px-4 py-3 border-l-4 border-emerald-400 bg-emerald-50">₹0.90/msg</td></tr>
                <tr className="border-t border-slate-200 bg-white"><td className="px-4 py-3 font-semibold">Setup Ease</td><td className="px-4 py-3">Complex</td><td className="px-4 py-3">Developer Required</td><td className="px-4 py-3 border-l-4 border-emerald-400 bg-emerald-50">1-Click Doctor Workspace</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-20 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold mb-3">Savings Calculator</h3>
            <p className="text-sm text-slate-500 mb-4">Estimate your costs vs a typical competitor. Adjust monthly message volume and duration.</p>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Monthly Message Volume</label>
                <input type="range" min={500} max={20000} step={100} value={sliderValue} onChange={(e) => setSliderValue(Number(e.target.value))} className="w-full mt-3" />
                <div className="flex justify-between text-xs text-slate-500 mt-2"><span>500</span><span>{sliderValue.toLocaleString()} msgs</span><span>20,000</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="p-4 rounded-md bg-slate-50 border border-slate-100 text-center"><div className="text-xs text-slate-500">Competitor Cost</div><div className="text-2xl font-extrabold text-rose-500">₹{competitorCost.toLocaleString()}</div><div className="text-xs text-slate-400">for {periodLabel}</div></div>
                <div className="p-4 rounded-md bg-slate-50 border border-slate-100 text-center"><div className="text-xs text-slate-500">Yogi Desk Cost</div><div className="text-2xl font-extrabold text-emerald-600">₹{yogiCost.toLocaleString()}</div><div className="text-xs text-slate-400">({selectedPlan.toUpperCase()} plan)</div></div>
                <div className="p-4 rounded-md bg-emerald-50 border border-emerald-100 text-center"><div className="text-xs text-slate-500">Estimated Savings</div><div className="text-3xl font-extrabold text-emerald-700">₹{savings.toLocaleString()}</div><div className="text-xs text-slate-400">vs competitor for {periodLabel}</div></div>
              </div>

              <div className="mt-4 p-4 rounded-md bg-gradient-to-r from-emerald-50 to-white border border-emerald-100">
                <div className="text-xl font-bold text-emerald-800">🎉 Dr. Doctor, you are saving <span className="text-emerald-900">₹{savings.toLocaleString()}</span> every <span className="font-semibold">{periodLabel}</span> by switching to Yogi Desk!</div>
                <div className="text-sm text-slate-500 mt-2">Based on {sliderValue.toLocaleString()} messages per month and the {duration.label} billing cycle.</div>
              </div>
            </div>
          </div>

          <aside className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h4 className="text-lg font-bold mb-3">Plan Quick Pick</h4>
            <div className="space-y-3">
              {PLANS.map((p) => (
                <div key={p.id} className={`flex items-center justify-between p-3 rounded-md ${selectedPlan === p.id ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-100'}`}>
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-slate-500">₹{prices[p.id]}/mo</div>
                  </div>
                  <div>
                    <button onClick={() => setSelectedPlan(p.id)} className={`px-3 py-1 rounded-md text-sm font-semibold ${selectedPlan === p.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>{selectedPlan === p.id ? 'Active' : 'Select'}</button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
