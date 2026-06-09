import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { supabase } from '../../config/supabaseClient';
import api from '../../utils/api';
import HiddenNotFound from './HiddenNotFound';

const sanitizeEmail = (value) => String(value || '').trim().toLowerCase().replace(/[^\w.+@-]/g, '');

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/superadmin/login', {
        email: sanitizeEmail(form.email),
        password: form.password,
      });
      if (!data?.session?.access_token || data?.user?.role !== 'superadmin') {
        setHidden(true);
        return;
      }
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      navigate('/superadmin/dashboard', { replace: true });
    } catch {
      setHidden(true);
    } finally {
      setLoading(false);
    }
  };

  if (hidden) return <HiddenNotFound />;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
        <form onSubmit={submitLogin} className="w-full rounded-md border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/30">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-orange-600 text-white">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-300">Hidden Owner Gate</p>
              <h1 className="text-2xl font-black">Super Admin</h1>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-orange-500"
                autoComplete="email"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-orange-500"
                autoComplete="current-password"
                required
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#FF6A00] px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-orange-600 disabled:opacity-60"
          >
            <LockKeyhole size={18} />
            {loading ? 'Verifying' : 'Enter Control'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
