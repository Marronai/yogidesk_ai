import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';
import { persistSupabaseSession } from '../utils/authSession';

const validatePassword = (password) => {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Add at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Add at least one lowercase letter.';
  if (!/\d/.test(password)) return 'Add at least one number.';
  return '';
};

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invitedEmail = useMemo(() => String(searchParams.get('email') || '').trim().toLowerCase(), [searchParams]);
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordError = validatePassword(form.password);
  const confirmError = form.confirmPassword && form.password !== form.confirmPassword
    ? 'Passwords do not match.'
    : '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setNotice('');
    setSuccess(false);

    if (!invitedEmail) {
      setNotice('Invite email is missing. Please open the link from your invitation email.');
      return;
    }
    if (passwordError) {
      setNotice(passwordError);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setNotice('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/team/setup-password', {
        email: invitedEmail,
        password: form.password,
      });

      const { data, error } = await supabase.auth.signInWithPassword({
        email: invitedEmail,
        password: form.password,
      });
      if (error) throw error;

      if (data?.user) {
        persistSupabaseSession(data.user, {
          email: invitedEmail,
          name: data.user.user_metadata?.staff_name || data.user.user_metadata?.name || invitedEmail,
          role: 'STAFF',
        });
        localStorage.setItem('user_role', 'STAFF');
        sessionStorage.setItem('user_role', 'STAFF');
      }

      setSuccess(true);
      setNotice('Password set successfully. Opening your staff dashboard...');
      setTimeout(() => navigate('/staff/dashboard', { replace: true }), 500);
    } catch (error) {
      setNotice(error?.response?.data?.message || error.message || 'Unable to complete invite setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 font-sans">
      <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          <ShieldCheck size={28} />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Yogi Desk Invite</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Complete Staff Account Setup</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
          Create a password for the email your clinic admin invited. This email is locked to protect the workspace.
        </p>

        {notice && (
          <div className={`mt-5 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
            success ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-800'
          }`}>
            {success ? <CheckCircle2 className="mt-0.5 shrink-0" size={18} /> : <KeyRound className="mt-0.5 shrink-0" size={18} />}
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Invited Email</span>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                value={invitedEmail}
                disabled
                readOnly
                className="w-full rounded-2xl border border-slate-200 bg-slate-100 py-3 pl-12 pr-4 text-sm font-bold text-slate-600 outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Create Password</span>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Create Password"
                className="w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 text-sm font-semibold outline-none focus:border-orange-400"
              />
            </div>
            {form.password && passwordError && <p className="mt-2 text-xs font-bold text-amber-700">{passwordError}</p>}
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Confirm Password</span>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                placeholder="Confirm Password"
                className="w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 text-sm font-semibold outline-none focus:border-orange-400"
              />
            </div>
            {confirmError && <p className="mt-2 text-xs font-bold text-amber-700">{confirmError}</p>}
          </label>

          <button
            type="submit"
            disabled={loading || !invitedEmail || Boolean(passwordError) || form.password !== form.confirmPassword}
            className="w-full rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 transition hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {loading ? 'Setting Password...' : 'Set Password & Complete Setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvite;
