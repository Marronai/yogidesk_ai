import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';

const securityTips = [
  'Use a mix of symbols, numbers, and letters.',
  'Never share your password with anyone, including staff.',
  'Enable 2FA for an extra layer of protection.',
];

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTip, setActiveTip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const validation = useMemo(() => ({
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    match: password === confirmPassword && password.length > 0,
  }), [confirmPassword, password]);

  const strengthScore = [validation.length, validation.uppercase, validation.special]
    .filter(Boolean).length;
  const strengthLabel = ['Too weak', 'Getting started', 'Almost there', 'Strong'][strengthScore];
  const isValid = validation.length && validation.uppercase && validation.special && validation.match;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveTip((current) => (current + 1) % securityTips.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) setError('Invalid or expired reset link. Please request a new one.');
    };
    checkSession();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const response = await api.post('/auth/confirm-password-reset', { password });
      if (!response.data?.success) throw new Error(response.data?.msg || 'Unable to update password.');

      setSuccessMessage('Password Updated Successfully');
      setPassword('');
      setConfirmPassword('');
      await supabase.auth.signOut().catch(() => {});
      window.setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (resetError) {
      setError(resetError.response?.data?.msg || resetError.message || 'Failed to reset password. Link might be expired.');
    } finally {
      setLoading(false);
    }
  };

  const Requirement = ({ label, passed }) => (
    <div className={`flex items-center gap-2 text-xs font-bold ${passed ? 'text-emerald-600' : 'text-slate-400'}`}>
      {passed ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="relative flex min-h-dvh overflow-x-hidden overflow-y-auto bg-[#05070b] font-sans text-slate-950 lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,107,0,0.18)_0%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_10%,rgba(37,99,235,0.13),transparent_30%),linear-gradient(135deg,rgba(8,16,31,0.98),rgba(3,6,12,0.99)_54%,rgba(5,7,11,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.5)_76%)]" />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <aside className="relative hidden min-h-[720px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#05070b]/80 px-10 py-12 text-white shadow-2xl shadow-black/40 backdrop-blur-xl lg:flex lg:flex-col lg:justify-between xl:px-14">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,107,0,0.2),transparent_34%),radial-gradient(circle_at_80%_15%,rgba(56,189,248,0.08),transparent_30%)]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-orange-500/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/35">
            <ShieldCheck size={26} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.28em] text-orange-300">YogiDesk</p>
            <p className="text-xs font-semibold text-slate-400">Secure clinical workspace</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.35em] text-orange-400">Security Tips</p>
          <div className="min-h-[180px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTip}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <h1 className="text-4xl font-black leading-tight tracking-tight xl:text-5xl">
                  Keep your patient data protected.
                </h1>
                <p className="mt-6 text-xl font-semibold leading-relaxed text-slate-300">
                  {securityTips[activeTip]}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-10 flex gap-2">
            {securityTips.map((tip, index) => (
              <button
                key={tip}
                type="button"
                aria-label={`Show security tip ${index + 1}`}
                onClick={() => setActiveTip(index)}
                className={`h-1.5 rounded-full transition-all ${index === activeTip ? 'w-10 bg-orange-500' : 'w-4 bg-white/20 hover:bg-white/40'}`}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
          <p className="text-sm font-bold text-slate-200">Password resets are protected by verified recovery sessions.</p>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">Choose a password that your team cannot guess and your browser cannot reuse elsewhere.</p>
        </div>
        </aside>

        <main className="flex min-h-dvh items-center justify-center py-6 lg:min-h-[720px]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white p-6 shadow-2xl shadow-black/35 sm:p-8"
        >
          <div className="mb-8">
            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-orange-400 shadow-lg shadow-slate-900/20">
              <Lock size={26} />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-500">Secure Reset</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Create New Password</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
              Set a strong password to protect your clinical data.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>{successMessage}. Redirecting to login...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">New Password</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-orange-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  placeholder="Enter a strong password"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-12 text-sm font-bold text-slate-950 outline-none transition-all placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-orange-500"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Confirm Password</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-orange-500" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  placeholder="Re-enter password"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-12 text-sm font-bold text-slate-950 outline-none transition-all placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-orange-500"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Password Strength</p>
                <p className={`text-xs font-black ${strengthScore === 3 ? 'text-emerald-600' : 'text-orange-500'}`}>{strengthLabel}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className={`h-2 rounded-full transition-all ${strengthScore > item ? 'bg-orange-500' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Requirement label="8+ characters" passed={validation.length} />
                <Requirement label="Uppercase letter" passed={validation.uppercase} />
                <Requirement label="Symbol included" passed={validation.special} />
                <Requirement label="Passwords match" passed={validation.match} />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isValid || loading || Boolean(successMessage)}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:bg-orange-600 disabled:translate-y-0 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : 'Update Password'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </motion.section>
        </main>
      </div>
    </div>
  );
};

export default ResetPassword;
