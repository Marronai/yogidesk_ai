import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, X, ArrowLeft, Zap, Crown, Target, Rocket, ChevronDown, ChevronUp, ShieldCheck, TrendingUp, Users2 } from 'lucide-react';

const Pricing = () => {
  const [billingCycle, setBillingCycle] = useState('yearly'); 
  const [expandedPlan, setExpandedPlan] = useState(null);
  const [loading, setLoading] = useState(null);
  const navigate = useNavigate();

  const plans = [
    {
      id: "lite",
      name: "Lite",
      tagline: "Perfect for Solo Starters",
      icon: <Zap size={28} className="text-slate-400" />,
      monthly: 499, quarterly: 1299, yearly: 4999,
      features: [
        { label: "300 Contacts Limit", included: true },
        { label: "Only Admin Access", included: true },
        { label: "Manual Templates", included: true },
        { label: "Basic Analytics (Sent)", included: true },
        { label: "Shift Timing Lock", included: false },
        { label: "Bulk Broadcast", included: false },
        { label: "Ads CRM Access", included: false },
        { label: "Data Export", included: false }
      ]
    },
    {
      id: "elite",
      name: "Elite",
      tagline: "Small Team Powerhouse",
      popular: true,
      icon: <Target size={28} className="text-orange-600" />,
      monthly: 999, quarterly: 2599, yearly: 9999,
      features: [
        { label: "600 Contacts Limit", included: true },
        { label: "Admin + 2 Members Team", included: true },
        { label: "Basic Shift Timing Lock", included: true },
        { label: "Bulk Broadcast Messaging", included: true },
        { label: "Shared Team Inbox", included: true },
        { label: "Message Delay Protection", included: true },
        { label: "Scheduled Messaging", included: false },
        { label: "Ghost Mode", included: false }
      ]
    },
    {
      id: "bronze",
      name: "Bronze",
      tagline: "The Growing Business Choice",
      icon: <Rocket size={28} className="text-blue-600" />,
      monthly: 1499, quarterly: 3999, yearly: 15788,
      features: [
        { label: "1,000 Contacts Limit", included: true },
        { label: "Admin + 6 Members Team", included: true },
        { label: "Advanced Shift Scheduling", included: true },
        { label: "Scheduled Broadcasts", included: true },
        { label: "Ghost Mode (Internal Notes)", included: true },
        { label: "Read & Click Tracking", included: true },
        { label: "Full Ads CRM (Meta + Google)", included: true },
        { label: "Lead Capture from Ads", included: false }
      ]
    },
    {
      id: "premium",
      name: "Premium",
      tagline: "The Scale Beast",
      icon: <Crown size={28} className="text-yellow-500" />,
      monthly: 2499, quarterly: 6399, yearly: 26999,
      features: [
        { label: "2,000 Contacts Limit", included: true },
        { label: "Admin + 9 Members Team", included: true },
        { label: "24/7 Shift Monitoring", included: true },
        { label: "Advanced Anti-Block Engine", included: true },
        { label: "Automation & API Access", included: true },
        { label: "Deep ROI & Campaign Analytics", included: true },
        { label: "Lead Capture & Auto-Reply", included: true },
        { label: "Advanced Ghost Mode", included: true }
      ]
    }
  ];

  const calculateDaily = (total) => (total / 365).toFixed(1);

  // 💳 CASHFREE PAYMENT HANDLER
  const handlePayment = async (plan) => {
    setLoading(plan.id);
    try {
      const token = localStorage.getItem('token');
      const amount = billingCycle === 'monthly' ? plan.monthly : billingCycle === 'quarterly' ? plan.quarterly : plan.yearly;

      // 1. Backend API to create order
      const { data } = await axios.post('http://localhost:5000/api/payments/create', {
        planId: plan.id,
        amount: amount,
        planName: plan.name,
        cycle: billingCycle
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // 2. Initialize Cashfree SDK
      const cashfree = window.Cashfree({
        mode: "sandbox" // Change to "production" for real payments
      });

      // 3. Open Checkout
      let checkoutOptions = {
        paymentSessionId: data.payment_session_id,
        redirectTarget: "_modal", 
      };

      cashfree.checkout(checkoutOptions).then((result) => {
        if (result.error) {
          alert(result.error.message);
        }
        if (result.redirect) {
          console.log("Payment verification needed");
        }
      });

    } catch (err) {
      console.error(err);
      alert("Payment initiation failed. Please check login status.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] py-20 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        <Link to="/" className="inline-flex items-center text-sm font-bold text-slate-400 hover:text-orange-600 transition-all mb-12">
          <ArrowLeft size={18} className="mr-2"/> Back to System
        </Link>

        <div className="flex justify-center mb-6">
          <span className="bg-orange-100 text-orange-700 px-6 py-2 rounded-full text-sm font-black tracking-wide border border-orange-200 animate-bounce">
            🔥 5-DAYS FREE TRIAL: NO CREDIT CARD REQUIRED!
          </span>
        </div>

        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight leading-none">
            Scale your <span className="text-orange-600">Sales</span> faster.
          </h1>
          <p className="text-slate-500 max-w-2xl mx-auto text-lg font-medium">
            Join 500+ businesses using Yogidesk. Every plan includes a 5-day risk-free trial.
          </p>
          
          <div className="flex flex-col items-center gap-4 mt-12">
            <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-1 border border-slate-200 shadow-inner">
              {['monthly', 'quarterly', 'yearly'].map((cycle) => (
                <button
                  key={cycle}
                  onClick={() => setBillingCycle(cycle)}
                  className={`px-10 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    billingCycle === cycle ? 'bg-orange-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8 mb-24">
          {plans.map((plan) => {
            const currentPrice = billingCycle === 'monthly' ? plan.monthly : billingCycle === 'quarterly' ? plan.quarterly : plan.yearly;
            const dailyPrice = calculateDaily(plan.yearly);

            return (
              <div key={plan.id} className={`relative bg-white rounded-[3rem] border-2 transition-all duration-500 p-8 flex flex-col ${plan.popular ? 'border-orange-500 shadow-2xl shadow-orange-100' : 'border-slate-100'}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-600 text-white px-6 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                    Recommended Plan
                  </div>
                )}

                <div className="mb-8">
                  <div className="mb-4">{plan.icon}</div>
                  <h3 className="text-3xl font-black text-slate-900">{plan.name}</h3>
                  <p className="text-slate-400 text-xs font-bold">{plan.tagline}</p>
                </div>

                <div className="mb-8 h-24">
                  {billingCycle === 'yearly' ? (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-6xl font-black text-slate-900">₹{dailyPrice}</span>
                        <span className="text-slate-400 font-bold text-sm">/day</span>
                      </div>
                      <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase">Billed as ₹{plan.yearly} annually</p>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-slate-900">₹{currentPrice}</span>
                      <span className="text-slate-400 font-bold text-sm">/{billingCycle === 'monthly' ? 'mo' : '3mo'}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <button 
                    onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                    className="w-full text-left flex items-center justify-between text-slate-900 text-xs font-black uppercase tracking-widest mb-6 border-b border-slate-50 pb-2"
                  >
                    Feature List {expandedPlan === plan.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                  </button>

                  <div className={`space-y-4 ${expandedPlan === plan.id ? 'max-h-full' : 'max-h-[160px] overflow-hidden'}`}>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm font-medium">
                        {feat.included ? (
                          <Check size={16} className="text-green-500 mt-1 flex-shrink-0" />
                        ) : (
                          <X size={16} className="text-red-500 mt-1 flex-shrink-0" />
                        )}
                        <span className={`${feat.included ? 'text-slate-700' : 'text-red-400 line-through decoration-red-600 decoration-2 italic'}`}>
                          {feat.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  disabled={loading === plan.id}
                  onClick={() => handlePayment(plan)}
                  className={`mt-10 w-full py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest transition-all ${
                    plan.popular ? 'bg-orange-600 text-white shadow-xl shadow-orange-100 hover:bg-orange-700' : 'bg-slate-900 text-white hover:bg-black'
                  }`}
                >
                  {loading === plan.id ? 'Loading...' : `Get ${plan.name} Now`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Growth Section */}
        <div className="grid md:grid-cols-3 gap-12 mb-24 py-12 border-t border-slate-100">
           {/* ... Growth Items Remain Same ... */}
        </div>

        {/* 🛠️ Enterprise Box - Fixed Italic and Styling */}
        <div className="bg-slate-900 rounded-[3.5rem] p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-600/10 rounded-full blur-[100px]"></div>
          <h2 className="text-4xl font-black text-white mb-4">Scaling Beyond 2,000 Contacts?</h2>
          <p className="text-slate-400 font-bold mb-8 max-w-lg mx-auto">If your team is large or you need custom API automation, our Enterprise Plan is for you. Let's talk scale.</p>
          <button className="bg-orange-600 text-white px-12 py-4 rounded-full font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-orange-600/20">
            Contact Sales
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;