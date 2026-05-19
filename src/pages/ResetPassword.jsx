import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, XCircle, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../config/supabaseClient';
import { API_URL } from '../utils/api';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validation = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    match: password === confirmPassword && password.length > 0
  };

  const isValid = Object.values(validation).every(Boolean);

  useEffect(() => {
    // Verify that we are in a recovery flow (checking for access_token in URL/Hash)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Invalid or expired reset link. Please request a new one.");
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      const { data: { user }, error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // ⚡ Trigger Backend Transactional Alert
      await fetch(`${API_URL}/api/auth/dispatch-login-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.full_name || 'Doctor',
          event: 'password_reset_success',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        }),
      }).catch(() => {}); // Fire and forget background alert

      alert("Password successfully updated. Please login with your new credentials.");
      navigate('/login');
    } catch (error) {
      setError(error.message || "Failed to reset password. Link might be expired.");
    } finally {
      setLoading(false);
    }
  };

  const ValidationItem = ({ label, passed }) => (
    <div className={`flex items-center gap-2 text-xs font-bold transition-colors ${passed ? 'text-emerald-600' : 'text-slate-400'}`}>
      {passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {label}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200/60 w-full max-w-md border border-slate-100 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"></div>
        
        <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200 mb-8">
          <ShieldCheck size={32} />
        </div>

        <h2 className="text-3xl font-black text-slate-900 mb-2">Secure Reset 🔑</h2>
        <p className="text-slate-500 font-medium mb-8">Establish a new high-strength password for your clinical workspace.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">New Password</label>
            <div className="relative group">
               <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
               <input 
                 type="password" 
                 required 
                 placeholder="••••••••" 
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all" 
                 onChange={(e) => setPassword(e.target.value)} 
               />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm Password</label>
            <div className="relative group">
               <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" />
               <input 
                 type="password" 
                 required 
                 placeholder="••••••••" 
                 className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all" 
                 onChange={(e) => setConfirmPassword(e.target.value)} 
               />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-2 mt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Strength Check</p>
            <div className="grid grid-cols-2 gap-y-2">
              <ValidationItem label="8+ Characters" passed={validation.length} />
              <ValidationItem label="1 Uppercase" passed={validation.uppercase} />
              <ValidationItem label="1 Number" passed={validation.number} />
              <ValidationItem label="1 Special Char" passed={validation.special} />
              <ValidationItem label="Passwords Match" passed={validation.match} />
            </div>
          </div>

          <button 
            disabled={!isValid || loading} 
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 hover:bg-black disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2 transform active:scale-[0.98] mt-4"
          >
            {loading ? <Loader2 className="animate-spin" size={18}/> : "Set New Password"}
            {!loading && <ArrowRight size={18}/>}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
export default ResetPassword;