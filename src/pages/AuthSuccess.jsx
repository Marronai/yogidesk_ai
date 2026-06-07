import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, BriefcaseMedical, Loader2, Phone, ShieldCheck } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { persistSupabaseSession } from '../utils/authSession';
import api from '../utils/api';

const specializations = [
  'General Physician',
  'Dentist',
  'Cardiologist',
  'Diabetologist',
  'Pediatrician',
  'Gynecologist',
  'Dermatologist',
  'Orthopedic',
  'Psychiatrist',
  'Others',
];

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    clinic_name: '',
    specialization: '',
    whatsapp_phone_number_id: '',
  });

  const displayEmail = useMemo(() => user?.email || 'your Google account', [user]);

  useEffect(() => {
    let active = true;

    const completeSupabaseOAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const sessionUser = data.session?.user;
        if (!sessionUser) throw new Error('Supabase session missing after OAuth redirect');
        if (!active) return;

        setUser(sessionUser);
        persistSupabaseSession(sessionUser, { welcomeGift: true });
        localStorage.setItem('user_subscription_status', 'active');

        const response = await api.get('/profile/context', { params: { userId: sessionUser.id } });
        const profile = response.data?.profile || {};
        const missingProfile = !profile.clinic_name || !profile.specialization || !profile.whatsapp_phone_number_id;

        if (missingProfile) {
          setForm((current) => ({
            ...current,
            clinic_name: profile.clinic_name || sessionUser.user_metadata?.business_name || '',
            specialization: profile.specialization || sessionUser.user_metadata?.specialization || sessionUser.user_metadata?.business_category || '',
            whatsapp_phone_number_id: profile.whatsapp_phone_number_id || '',
          }));
          setNeedsOnboarding(true);
          setLoading(false);
          return;
        }

        navigate('/dashboard', { replace: true });
      } catch (error) {
        console.error('Supabase OAuth completion error:', error);
        navigate('/login?error=invalid_token', { replace: true });
      }
    };

    completeSupabaseOAuth();
    return () => { active = false; };
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!form.clinic_name.trim()) {
      setMessage('Clinic name is required.');
      return;
    }
    if (!form.specialization.trim()) {
      setMessage('Specialization is required.');
      return;
    }
    if (!form.whatsapp_phone_number_id.trim()) {
      setMessage('Active Meta WhatsApp Phone Number ID is required.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/profile/onboarding', {
        userId: user.id,
        clinic_name: form.clinic_name.trim(),
        specialization: form.specialization,
        whatsapp_phone_number_id: form.whatsapp_phone_number_id.trim(),
      });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Unable to save onboarding details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !needsOnboarding) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-white px-4">
        <Loader2 size={48} className="mx-auto mb-4 animate-spin text-[#FF6B00]" />
        <h2 className="mb-2 text-2xl font-bold text-gray-800">Logging you in...</h2>
        <p className="text-center text-gray-600">Please wait while we complete your Google sign-in.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950/95 px-4 py-10 font-sans">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          <ShieldCheck size={28} />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Google Account Setup</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">Complete Your Clinic Profile</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
          We verified {displayEmail}. Add the required clinic details before entering your dashboard.
        </p>

        {message && (
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={form.clinic_name}
              onChange={(event) => setForm((current) => ({ ...current, clinic_name: event.target.value }))}
              placeholder="Clinic Name"
              className="w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 text-sm font-semibold outline-none focus:border-orange-400"
            />
          </div>

          <div className="relative">
            <BriefcaseMedical className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={form.specialization}
              onChange={(event) => setForm((current) => ({ ...current, specialization: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm font-semibold outline-none focus:border-orange-400"
            >
              {specializations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={form.whatsapp_phone_number_id}
              onChange={(event) => setForm((current) => ({ ...current, whatsapp_phone_number_id: event.target.value }))}
              placeholder="Active Meta WhatsApp Phone Number ID"
              className="w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 text-sm font-semibold outline-none focus:border-orange-400"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 transition hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            Save Profile & Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthSuccess;
