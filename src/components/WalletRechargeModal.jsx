import React, { useState } from 'react';
import { X, Wallet, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

const RECHARGE_OPTIONS = [
  { amount: 500, label: 'Starter Pack', desc: 'Perfect for small clinics' },
  { amount: 1000, label: 'Most Popular', desc: 'Best for growing practices', popular: true },
  { amount: 2000, label: 'Value Pack', desc: 'Bulk savings for hospitals' },
];

const WalletRechargeModal = ({ isOpen, onClose, onSuccess, userId }) => {
  const [selectedAmount, setSelectedAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
      } else {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      }
    });
  };

  const handleRecharge = async () => {
    setLoading(true);
    try {
      // Load Razorpay script first
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        alert('Failed to load payment gateway. Please try again.');
        setLoading(false);
        return;
      }

      // Create Razorpay order
      const { data } = await api.post('/payments/wallet/create-order', {
        userId,
        amount: selectedAmount
      });

      if (!data.success || !data.order_id) {
        alert(data.message || 'Failed to initialize payment. Please try again.');
        setLoading(false);
        return;
      }

      // Open Razorpay checkout modal
      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        image: `${window.location.origin}/logo.png`,
        name: 'YogiDesk AI - Wallet Recharge',
        theme: {
          color: '#F97316'
        },
        handler: async (response) => {
          try {
            // Verify payment on backend
            const verifyRes = await api.post('/payments/wallet/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId,
              amount: selectedAmount
            });

            if (verifyRes.data.success) {
              onSuccess(verifyRes.data.newBalance);
              onClose();
            } else {
              alert('Payment verification failed. Please contact support.');
            }
          } catch (err) {
            console.error('Payment verification error:', err);
            alert('Payment verification failed. Please try again.');
          }
        },
        prefill: {
          contact: '',
          email: ''
        },
        notes: {
          wallet_recharge: true,
          amount: selectedAmount
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error('Recharge failed:', err);
      alert(err.response?.data?.message || 'Failed to process recharge. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="p-8 pb-0 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Wallet className="text-orange-600" /> Recharge Wallet
            </h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Add credits to send broadcasts & reminders.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="p-8 space-y-4">
          {RECHARGE_OPTIONS.map((opt) => (
            <button
              key={opt.amount}
              onClick={() => setSelectedAmount(opt.amount)}
              className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all text-left group ${
                selectedAmount === opt.amount 
                ? 'border-orange-500 bg-orange-50/50' 
                : 'border-slate-100 hover:border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  selectedAmount === opt.amount ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  <span className="font-black text-lg">₹</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">₹{opt.amount}</span>
                    {opt.popular && (
                      <span className="bg-orange-100 text-orange-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{opt.desc}</p>
                </div>
              </div>
              {selectedAmount === opt.amount && (
                <CheckCircle2 className="text-orange-600" size={24} />
              )}
            </button>
          ))}
        </div>

        {/* Action Button */}
        <div className="p-8 pt-0">
          <button
            onClick={handleRecharge}
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-orange-600 disabled:bg-slate-400 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>Pay ₹{selectedAmount} Now <Sparkles size={18} /></>
            )}
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-tight">Pay securely via Razorpay</p>
        </div>
      </motion.div>
    </div>
  );
};

export default WalletRechargeModal;