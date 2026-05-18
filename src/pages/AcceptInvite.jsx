import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';

const AcceptInvite = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);

  const tokenHint = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('token_hash') || params.get('access_token') || hash.get('access_token') || '';
  }, []);

  const incomingUserEmailInputString = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return (params.get('email') || hash.get('email') || '').trim().toLowerCase();
  }, []);

  const activate = async (event) => {
    event.preventDefault();
    setToast('');

    const newPasswordString = form.password.trim();
    if (newPasswordString.length < 8) {
      setToast('Password must be at least 8 characters.');
      return;
    }
    if (newPasswordString !== form.confirm.trim()) {
      setToast('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPasswordString });
    if (error) {
      setToast(error.message || 'Activation failed.');
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    const activeEmail = incomingUserEmailInputString || data?.user?.email;
    if (activeEmail) {
      await supabase.from('team_members').update({ status: 'ACTIVE' }).eq('email', activeEmail);
    }

    setToast('Account activated successfully.');
    setTimeout(() => navigate('/login', { replace: true }), 900);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10 font-sans">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-100 shadow-xl p-8">
        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-6">
          <ShieldCheck size={28} />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Yogi Desk Invite</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Set Your Yogi Desk Account Password</h1>
        <p className="mt-2 text-sm text-slate-500">Create your password to activate secure staff access.</p>

        {toast && (
          <div className={`mt-5 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${toast.includes('success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>
            {toast.includes('success') ? <CheckCircle2 size={18} /> : <KeyRound size={18} />}
            {toast}
          </div>
        )}

        <form onSubmit={activate} className="mt-6 space-y-4">
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="New Password"
              className="w-full rounded-2xl border border-slate-200 pl-12 pr-4 py-3 text-sm font-semibold outline-none focus:border-orange-400"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
              placeholder="Confirm Password"
              className="w-full rounded-2xl border border-slate-200 pl-12 pr-4 py-3 text-sm font-semibold outline-none focus:border-orange-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !tokenHint}
            className="w-full rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {loading ? 'Activating...' : 'Activate Account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvite;
