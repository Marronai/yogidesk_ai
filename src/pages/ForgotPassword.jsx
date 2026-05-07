import React, { useState } from 'react';
import axios from 'axios';
import { Mail, ArrowRight, Loader2, CheckCircle2, AlertCircle, ShieldCheck, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [isThrottled, setIsThrottled] = useState(false);

  // 🔒 SECURITY PATCH: Hide Backend URL
  const API_URL = import.meta.env.VITE_API_URL || 'https://yogidesk-ai.com';

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    // 1. Input Validation
    if (!validateEmail(email)) {
      setMsg({ type: 'error', text: "Please enter a valid email address." });
      return;
    }

    // 2. Rate Limiting Check
    if (isThrottled) {
      setMsg({ type: 'error', text: "Please wait 60 seconds before trying again." });
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/forgotpassword`, { email });
      
      // 🔒 SECURITY PATCH: Generic Success Message (User Enumeration Prevention)
      // Hacker ko mat batao ki email exist karta hai ya nahi.
      setMsg({ type: 'success', text: "If an account exists with this email, a reset link has been sent." });
      
      // Start Cooldown (60s)
      setIsThrottled(true);
      setTimeout(() => setIsThrottled(false), 60000);

    } catch (error) {
      // Even on error, show generic message or specific server error if needed (carefully)
      setMsg({ type: 'error', text: "Something went wrong. Please try again later." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      
      {/* ========================================== */}
      {/* 1. LEFT SIDE: FORM SECTION                 */}
      {/* ========================================== */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 relative bg-white">
        
        {/* Mobile Blob */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px] lg:hidden"></div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.6 }}
          className="w-full max-w-md z-10"
        >
          {/* Logo Area */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-500/30">M</div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Marroncorp</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">Forgot Password? 🔒</h2>
            <p className="text-gray-500">Don't worry, it happens to the best of us.</p>
          </div>

          {/* Status Message Area */}
          {msg.text && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl mb-6 text-sm font-medium flex items-start gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}
            >
              {msg.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0"/> : <AlertCircle size={18} className="mt-0.5 shrink-0"/>}
              {msg.text}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email" 
                  required 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#FF6B00]/20 focus:border-[#FF6B00] block pl-12 p-3.5 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>
            </div>

            <button 
              disabled={loading || isThrottled} 
              className={`w-full text-white py-4 rounded-xl font-bold transition-all shadow-xl flex justify-center items-center gap-2 transform active:scale-[0.98] mt-4 ${isThrottled ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#FF6B00] hover:bg-orange-600 shadow-orange-500/20 hover:shadow-orange-500/40'}`}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : (isThrottled ? "Check Email" : "Send Reset Link")} 
              {!loading && !isThrottled && <ArrowRight size={20}/>}
            </button>
          </form>

          <Link to="/login" className="mt-8 flex items-center justify-center gap-2 text-sm font-bold text-gray-500 hover:text-[#FF6B00] transition group">
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> Back to Login
          </Link>

        </motion.div>
      </div>

      {/* ========================================== */}
      {/* 2. RIGHT SIDE: BRANDING                    */}
      {/* ========================================== */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative justify-center items-center overflow-hidden">
        
        {/* Background Effects */}
        <div className="absolute top-[-20%] right-[-20%] w-[600px] h-[600px] bg-[#FF6B00] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-20%] left-[-20%] w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-20"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>

        <div className="relative z-10 max-w-md text-white text-center">
           <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 bg-[#FF6B00]/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-[#FF6B00]/30">
                 <ShieldCheck size={32} className="text-[#FF6B00]"/>
              </div>
           </div>
           <h2 className="text-4xl font-black leading-tight mb-6">
              Account Security <br/> is our <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-400">Priority.</span>
           </h2>
           <p className="text-slate-400 text-lg">
              We use industry-standard encryption to keep your data safe. A recovery link will be sent to your email instantly.
           </p>
        </div>
      </div>

    </div>
  );
};

export default ForgotPassword;