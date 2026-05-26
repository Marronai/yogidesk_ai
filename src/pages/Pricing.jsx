import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Hospital, ShieldCheck, Stethoscope, Users2, Wallet } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

const plans = [
  {
    name: 'Starter Clinic',
    price: 199,
    icon: <Stethoscope size={30} />,
    accent: 'text-blue-600 bg-blue-50',
    features: [
      'Up to 500 Active Patients',
      'Single Doctor Access',
      'Auto Appointment Reminders',
      '50+ Custom Templates',
      'Wallet Integration',
    ],
  },
  {
    name: 'Growth Clinic',
    price: 399,
    icon: <Users2 size={30} />,
    accent: 'text-orange-600 bg-orange-50',
    popular: true,
    features: [
      'Up to 2,000 Active Patients',
      'Admin + 2 Staff Members',
      'Shared Team Inbox',
      'Multi-Doctor Schedule',
      'Priority Approvals',
    ],
  },
  {
    name: 'Multi-Specialty Hospital',
    price: 799,
    icon: <Hospital size={30} />,
    accent: 'text-emerald-600 bg-emerald-50',
    features: [
      'Unlimited Patients',
      'Admin + 10 Staff/Doctors Access',
      'Facebook/Instagram Ads CRM',
      'Advanced Ghost Mode & Internal Notes',
    ],
  },
];

const Pricing = () => {
  return (
    <div className="min-h-screen bg-[#fcfcfc] py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <Link to="/" className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-orange-600 transition-all mb-12">
          <ArrowLeft size={18} className="mr-2" /> Back to Yogi Desk AI
        </Link>

        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-5 py-2 text-xs font-black uppercase tracking-widest text-orange-700">
            <ShieldCheck size={16} /> All Prices Include 18% GST - No Hidden Charges
          </div>
          <h1 className="mt-6 text-4xl md:text-6xl font-black text-slate-950 tracking-tight">
            Affordable WhatsApp care plans for every clinic
          </h1>
          <p className="mt-5 text-lg font-medium text-slate-500 max-w-2xl mx-auto">
            Pick a flat monthly plan, recharge your Yogi Wallet, and pay only for messages you send.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-[2rem] border bg-white p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${
                plan.popular ? 'border-orange-300 ring-4 ring-orange-50' : 'border-slate-100'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-8 rounded-full bg-orange-600 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                  Most Popular
                </div>
              )}

              <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl ${plan.accent}`}>
                {plan.icon}
              </div>
              <h2 className="text-2xl font-black text-slate-950">{plan.name}</h2>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-5xl font-black text-slate-950">₹{plan.price}</span>
                <span className="pb-2 text-sm font-bold text-slate-400">/ mo</span>
              </div>

              <ul className="mt-8 flex-1 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm font-semibold text-slate-600">
                    <Check size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/signup"
                className={`mt-8 inline-flex items-center justify-center rounded-2xl px-6 py-4 text-sm font-black uppercase tracking-widest transition ${
                  plan.popular
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-100 hover:bg-orange-700'
                    : 'bg-slate-950 text-white hover:bg-slate-800'
                }`}
              >
                Start with {plan.name}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-6 rounded-[2rem] border border-orange-100 bg-orange-50 p-6 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-600">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Wallet rates</p>
              <p className="text-xs font-semibold text-slate-500">Reminders ₹0.20/msg, marketing ₹0.90/msg</p>
            </div>
          </div>
          <div className="md:col-span-2 text-sm font-semibold text-orange-800">
            Manual UPI payments and wallet top-ups use <strong>yogidesk@icici</strong>. Recharge with ₹200 or more to unlock cashback eligibility.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
