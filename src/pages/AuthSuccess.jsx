import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2, Phone, ShieldCheck, Stethoscope, User } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { persistSupabaseSession } from '../utils/authSession';
import api from '../utils/api';
import { isJwtSegmentToken } from '../utils/tokenGuards';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

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

const readOAuthCallbackParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const storedFlow = sessionStorage.getItem('yogidesk_google_auth_flow') || localStorage.getItem('yogidesk_google_auth_flow') || '';
  const signupIntent = (
    sessionStorage.getItem('yogidesk_google_signup_pending') === 'true' ||
    localStorage.getItem('yogidesk_google_signup_pending') === 'true'
  );

  return {
    accessToken: searchParams.get('access_token') || hashParams.get('access_token') || '',
    refreshToken: searchParams.get('refresh_token') || hashParams.get('refresh_token') || '',
    legacyToken: searchParams.get('token') || hashParams.get('token') || '',
    code: searchParams.get('code') || hashParams.get('code') || '',
    flow: searchParams.get('flow') || hashParams.get('flow') || storedFlow,
    forceSignupOnboarding: signupIntent || searchParams.get('flow') === 'signup' || hashParams.get('flow') === 'signup',
  };
};

const cleanAuthCallbackUrl = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

const readProfileMobile = (profile = {}) => (
  profile.mobile || profile.phone_number || profile.phone || ''
);

const hasCompletedDoctorProfile = (profile = {}) => {
  const mobileDigits = String(readProfileMobile(profile)).replace(/\D/g, '').slice(-10);
  return Boolean(
    profile.id &&
    String(profile.name || '').trim() &&
    String(profile.clinic_name || '').trim() &&
    String(profile.specialization || profile.business_category || profile.clinic_category || '').trim() &&
    mobileDigits.length === 10
  );
};

const clearGoogleAuthFlow = () => {
  sessionStorage.removeItem('yogidesk_google_auth_flow');
  localStorage.removeItem('yogidesk_google_auth_flow');
  sessionStorage.removeItem('yogidesk_google_signup_pending');
  localStorage.removeItem('yogidesk_google_signup_pending');
};

const AuthSuccess = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    clinic_name: '',
    mobile_number: '',
    specialization: '',
  });

  const displayEmail = useMemo(() => user?.email || 'your Google account', [user]);

  useEffect(() => {
    let active = true;

    const completeSupabaseOAuth = async () => {
      try {
        const { accessToken, refreshToken, legacyToken, code, flow, forceSignupOnboarding } = readOAuthCallbackParams();
        const authFlow = String(flow || '').trim().toLowerCase();

        if (accessToken) {
          if (!isJwtSegmentToken(accessToken)) {
            console.error('Intercepted malformed JWT segment payload:', accessToken);
            localStorage.removeItem('sb-access-token');
            cleanAuthCallbackUrl();
            throw new Error('Malformed OAuth access token');
          }

          localStorage.setItem('sb-access-token', accessToken);
          if (refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
          cleanAuthCallbackUrl();
        } else if (legacyToken) {
          if (!isJwtSegmentToken(legacyToken)) {
            console.error('Intercepted malformed JWT segment payload:', legacyToken);
            localStorage.removeItem('token');
            cleanAuthCallbackUrl();
            throw new Error('Malformed OAuth token');
          }

          localStorage.setItem('token', legacyToken);
          cleanAuthCallbackUrl();
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          cleanAuthCallbackUrl();
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const sessionUser = data.session?.user;
        if (!sessionUser) throw new Error('Supabase session missing after OAuth redirect');
        if (!active) return;

        if (data.session?.access_token) {
          localStorage.setItem('sb-access-token', data.session.access_token);
          sessionStorage.setItem('sb-access-token', data.session.access_token);
        }

        setUser(sessionUser);
        persistSupabaseSession(sessionUser, { welcomeGift: true });
        localStorage.setItem('user_subscription_status', 'active');

        const { data: profileRow, error: profileError } = await supabase
          .from('doctor_profiles')
          .select('id, name, clinic_name, specialization, business_category, clinic_category, phone, phone_number, mobile')
          .eq('id', sessionUser.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!active) return;

        if (!forceSignupOnboarding && authFlow !== 'signup' && hasCompletedDoctorProfile(profileRow)) {
          console.log('[YogiDesk Auth] Completed doctor profile found after Google OAuth. Routing to dashboard.');
          if (!active) return;
          clearGoogleAuthFlow();
          navigate('/dashboard', { replace: true });
          return;
        }

        setForm((current) => ({
          ...current,
          full_name: profileRow?.name || sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || '',
          clinic_name: profileRow?.clinic_name || sessionUser.user_metadata?.business_name || '',
          mobile_number: readProfileMobile(profileRow) || sessionUser.user_metadata?.phone || '',
          specialization: profileRow?.specialization || profileRow?.business_category || profileRow?.clinic_category || sessionUser.user_metadata?.specialization || sessionUser.user_metadata?.business_category || '',
        }));
        if (!active) return;
        setNeedsOnboarding(true);
        setLoading(false);
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

    const mobileDigits = String(form.mobile_number || '').replace(/\D/g, '').slice(-10);

    if (!form.full_name.trim()) {
      setMessage('Full name is required.');
      return;
    }
    if (!form.clinic_name.trim()) {
      setMessage('Clinic name is required.');
      return;
    }
    if (mobileDigits.length !== 10) {
      setMessage('Enter a valid 10-digit mobile number connected to WhatsApp.');
      return;
    }
    if (!form.specialization.trim()) {
      setMessage('Specialization is required.');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/profile/onboarding', {
        userId: user.id,
        full_name: form.full_name.trim(),
        clinic_name: form.clinic_name.trim(),
        mobile_number: mobileDigits,
        specialization: form.specialization,
      });
      if (![200, 201].includes(response.status) || response.data?.success !== true) {
        throw new Error(response.data?.message || 'Profile was not saved. Please try again.');
      }
      clearGoogleAuthFlow();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setMessage(error?.response?.data?.message || error.message || 'Unable to save onboarding details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4 font-sans">
        <div className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50 px-5 py-4 text-sm font-black text-orange-700">
          <Loader2 size={18} className="animate-spin" />
          Preparing clinic setup
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,107,0,0.12),transparent_34%),#fff7ed] px-4 py-10 font-sans">
      {saving && <AuthLoadingScreen message="Saving your clinic profile..." />}
      <div className="w-full max-w-xl rounded-3xl border border-orange-100 bg-white p-6 shadow-2xl shadow-orange-100/70 sm:p-8">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
          <ShieldCheck size={28} />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">YogiDesk Clinic Setup</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Complete Your Doctor Profile</h1>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
          We verified {displayEmail}. Add your clinic identity before entering the operations dashboard.
        </p>

        {message && (
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              required
              value={form.full_name}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              placeholder="Full Name"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div className="relative">
            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              required
              value={form.clinic_name}
              onChange={(event) => setForm((current) => ({ ...current, clinic_name: event.target.value }))}
              placeholder="Clinic/Hospital Name"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div className="relative">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              required
              type="tel"
              inputMode="numeric"
              maxLength="10"
              value={form.mobile_number}
              onChange={(event) => setForm((current) => ({ ...current, mobile_number: event.target.value.replace(/\D/g, '').slice(0, 10) }))}
              placeholder="Mobile Number linked with WhatsApp"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div className="relative">
            <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              required
              value={form.specialization}
              onChange={(event) => setForm((current) => ({ ...current, specialization: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-bold text-slate-900 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
            >
              <option value="" disabled>Select Medical Specialization</option>
              {specializations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
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
