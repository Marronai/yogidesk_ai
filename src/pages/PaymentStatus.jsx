import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { useWallet } from '../context/WalletContext';

const PaymentStatus = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // States: verifying, success, failed
  const { fetchWalletData, fetchTransactions } = useWallet();
  const orderId = searchParams.get('order_id');
  const navigate = useNavigate();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // 🛡️ Backend verification call
        const res = await axios.post('http://localhost:5000/api/payments/verify', 
          { order_id: orderId },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.status === 200) {
          setStatus('success');
          // After successful payment, trigger a refresh of global wallet data
          await Promise.all([
            fetchWalletData(),
            fetchTransactions()]);
          // 3 second baad auto-redirect to dashboard
          setTimeout(() => navigate('/'), 3000);
        }
      } catch (err) {
        console.error("Payment Verification Error:", err);
        setStatus('failed');
      }
    };

    if (orderId) {
      verifyPayment();
    } else {
      // Agar URL mein order_id nahi hai toh seedha failed dikhao
      setStatus('failed');
    }
  }, [orderId, navigate, fetchWalletData, fetchTransactions]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-[3rem] p-12 shadow-2xl shadow-slate-200/60 border border-slate-100 text-center relative overflow-hidden">
        
        {/* Decorative Background Element */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-50 rounded-full blur-3xl opacity-50"></div>

        {/* --- 1. VERIFYING STATE --- */}
        {status === 'verifying' && (
          <div className="flex flex-col items-center">
            <div className="relative mb-6">
              <Loader2 className="text-orange-600 animate-spin" size={64} strokeWidth={3} />
              <div className="absolute inset-0 bg-orange-100/20 rounded-full blur-xl animate-pulse"></div>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Verifying Payment</h2>
            <p className="text-slate-500 font-bold mt-3 leading-relaxed">
              We are confirming your transaction with Cashfree. <br /> 
              <span className="text-orange-600">Please do not close this window.</span>
            </p>
          </div>
        )}

        {/* --- 2. SUCCESS STATE --- */}
        {status === 'success' && (
          <div className="flex flex-col items-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="text-green-600" size={48} strokeWidth={3} />
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">All Set! 🚀</h2>
            <p className="text-slate-500 font-bold mt-4 leading-relaxed">
              Payment successful. Your Yogi Desk AI Premium features are now unlocked.
            </p>
            <div className="mt-8 flex items-center gap-2 text-green-600 font-black text-xs uppercase tracking-widest animate-pulse">
              Redirecting to Dashboard <ArrowRight size={16}/>
            </div>
          </div>
        )}

        {/* --- 3. FAILED STATE --- */}
        {status === 'failed' && (
          <div className="flex flex-col items-center animate-in fade-in duration-500">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <XCircle className="text-red-600" size={48} strokeWidth={3} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Payment Failed</h2>
            <p className="text-slate-500 font-bold mt-3 leading-relaxed">
              We couldn't verify your transaction. Any amount deducted will be refunded by your bank.
            </p>
            <div className="mt-10 flex flex-col gap-3 w-full">
              <button 
                onClick={() => navigate('/pricing')}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-slate-200 hover:bg-black active:scale-95 transition-all"
              >
                Try Again
              </button>
              <button 
                onClick={() => navigate('/support')}
                className="w-full bg-white text-slate-400 py-3 rounded-2xl font-bold text-xs uppercase hover:text-slate-600 transition-colors"
              >
                Contact Support
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// 🛑 IMPORTANT: Yeh line ensure karti hai ki error na aaye
export default PaymentStatus;
