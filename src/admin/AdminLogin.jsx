import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../utils/api';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (step === 1) {
        await axios.post(`${API_URL}/api/admin/auth/login`, formData, {
          withCredentials: true,
        });
        setStep(2);
        setOtp('');
      } else {
        const { data } = await axios.post(`${API_URL}/api/admin/auth/verify-login`, {
          email: formData.email,
          otp,
        }, {
          withCredentials: true,
        });

        if (data.user?.role !== 'admin') {
          throw new Error('Admin role required.');
        }

        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_role', data.user.role);
        localStorage.setItem('admin_name', data.user.name || 'Admin');
        localStorage.setItem('admin_email', data.user.email || formData.email);
        navigate('/admin/dashboard');
      }
    } catch (error) {
      alert(error.response?.data?.msg || error.message || 'Admin login failed.');
      if (error.response?.status === 403) {
        setStep(1);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,107,0,0.25),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_30%)]" />
      <div className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-200">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">Yogi Desk</p>
            <h1 className="text-2xl font-black">Admin Login</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 ? (
            <>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Admin Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full rounded-2xl border border-slate-200 py-4 pl-12 pr-4 text-sm font-bold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    placeholder="admin@yogidesk-ai.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="w-full rounded-2xl border border-slate-200 py-4 pl-12 pr-12 text-sm font-bold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    placeholder="Admin password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Admin OTP</label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  className="w-full rounded-2xl border border-slate-200 py-4 pl-12 pr-4 text-center text-xl font-black tracking-[0.4em] outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  placeholder="000000"
                />
              </div>
              <p className="text-sm font-medium text-slate-500">OTP sent to {formData.email}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (step === 2 && otp.length !== 6)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            {step === 1 ? 'Send Admin OTP' : 'Verify & Enter'}
          </button>

          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-sm font-bold text-slate-500 hover:text-orange-600"
            >
              Use a different admin account
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
