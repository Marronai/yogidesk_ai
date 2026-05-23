import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Mail, Phone, Save, ShieldCheck, Smartphone, User } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';

const emptyForm = {
  name: '',
  email: '',
  whatsappPhoneNumberId: '',
  whatsappBusinessAccountId: '',
  whatsappAccessToken: '',
};

const getStoredAccount = () => {
  const userId = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || '';
  const email = localStorage.getItem('user_email') || sessionStorage.getItem('user_email') || '';
  return { userId: userId.trim(), email: email.trim() };
};

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [hasExistingConnection, setHasExistingConnection] = useState(false);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const showToast = (type, text) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3200);
  };

  const getActiveAccount = async () => {
    const { data, error } = await supabase.auth.getUser();
    const storedAccount = getStoredAccount();
    if (error && !storedAccount.userId) throw error;

    const authUser = data?.user || null;
    const userId = authUser?.id || storedAccount.userId;
    if (!userId) throw new Error('Unable to identify the current account.');

    return {
      authUser: authUser || { id: userId, email: storedAccount.email },
      userId,
    };
  };

  const hydrateProfile = async () => {
    setLoadingProfile(true);

    try {
      const { authUser, userId } = await getActiveAccount();
      const { data, error } = await supabase
        .from('doctor_profiles')
        .select('name,email')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      const { data: connectionResult } = await api.get('/settings/meta-connection');
      const connectionData = connectionResult?.data || {};
      const metaPhoneNumberId = connectionData.meta_phone_number_id || '';
      const metaWabaId = connectionData.meta_waba_id || '';
      const systemUserToken = connectionData.system_user_token || '';
      const connectionExists = Boolean(metaPhoneNumberId && metaWabaId && systemUserToken);

      const nextForm = {
        name: data?.name || authUser?.user_metadata?.full_name || localStorage.getItem('user_name') || '',
        email: data?.email || authUser?.email || localStorage.getItem('user_email') || '',
        whatsappPhoneNumberId: metaPhoneNumberId,
        whatsappBusinessAccountId: metaWabaId,
        whatsappAccessToken: systemUserToken,
      };

      setFormData(nextForm);
      setHasExistingConnection(connectionExists);
      setConnectionStatus(
        connectionExists ? 'connected' : 'disconnected'
      );
    } catch {
      showToast('error', 'Failed to update connection settings. Please try again.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    hydrateProfile();
  }, []);

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const { userId } = await getActiveAccount();
      const { error } = await supabase
        .from('doctor_profiles')
        .update({ name: formData.name.trim() || null })
        .eq('id', userId);

      if (error) throw error;

      localStorage.setItem('user_name', formData.name.trim());
      showToast('success', 'Account settings saved successfully.');
    } catch {
      showToast('error', 'Failed to update connection settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = async (event) => {
    event.preventDefault();
    setSavingConnection(true);

    try {
      const { authUser } = await getActiveAccount();

      const payload = {
        name: formData.name.trim(),
        email: formData.email || authUser?.email || '',
        whatsappPhoneNumberId: formData.whatsappPhoneNumberId,
        whatsappWabaId: formData.whatsappBusinessAccountId,
        whatsappBusinessAccountId: formData.whatsappBusinessAccountId,
        whatsappAccessToken: formData.whatsappAccessToken,
      };

      const { data: result } = await api.post('/settings/meta-connection', payload);

      if (!result?.success) {
        throw new Error(result.message || 'Failed to update connection settings. Please try again.');
      }

      setConnectionStatus(
        payload.whatsappPhoneNumberId && payload.whatsappBusinessAccountId && payload.whatsappAccessToken
          ? 'connected'
          : 'disconnected'
      );
      setHasExistingConnection(Boolean(payload.whatsappPhoneNumberId && payload.whatsappBusinessAccountId && payload.whatsappAccessToken));
      showToast('success', 'Connection settings saved successfully.');
    } catch (error) {
      console.error('Supabase Settings Sync Error:', error);
      showToast('error', error.message || 'Failed to update connection settings. Please try again.');
    } finally {
      setSavingConnection(false);
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="min-h-screen bg-orange-50/30 px-4 py-6 sm:px-6 lg:px-8">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border bg-white px-4 py-3 text-sm font-bold shadow-2xl sm:right-6 sm:top-6 ${
            toast.type === 'success'
              ? 'border-emerald-200 text-slate-800 shadow-emerald-100'
              : 'border-red-200 text-red-800 shadow-red-100'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === 'success' ? (
              <CheckCircle2 className="shrink-0 text-emerald-600" size={18} />
            ) : (
              <AlertCircle className="shrink-0 text-red-600" size={18} />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-3xl border border-orange-100 bg-white px-5 py-6 shadow-sm sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">Yogi Desk</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Settings</h1>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Manage your profile and WhatsApp Cloud API configuration.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-200">
              <ShieldCheck size={28} />
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <User size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-950">Profile Settings</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">Keep your account identity up to date.</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    readOnly
                    placeholder="you@example.com"
                    className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 py-4 pl-12 pr-4 text-sm font-bold text-slate-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Official Meta API Connection</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Add your clinic's Meta WhatsApp Cloud credentials here.
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  isConnected
                    ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                    : 'border-slate-200 bg-slate-100 text-slate-600'
                }`}
              >
                {isConnected ? 'Connected to Meta Cloud' : 'Not connected yet'}
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp Phone Number ID</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={formData.whatsappPhoneNumberId}
                    onChange={(event) => updateField('whatsappPhoneNumberId', event.target.value)}
                    disabled={hasExistingConnection}
                    placeholder="Enter your WhatsApp Phone Number ID"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp Business Account ID</label>
                <input
                  type="text"
                  value={formData.whatsappBusinessAccountId}
                  onChange={(event) => updateField('whatsappBusinessAccountId', event.target.value)}
                  disabled={hasExistingConnection}
                  placeholder="Enter your WABA ID"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">System User Access Token</label>
                <input
                  type="password"
                  value={formData.whatsappAccessToken}
                  onChange={(event) => updateField('whatsappAccessToken', event.target.value)}
                  disabled={hasExistingConnection}
                  placeholder="EAAMz..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-orange-800 sm:flex-1">
                Your WhatsApp credentials are used for authenticated Meta Cloud dispatch across campaigns and templates.
              </div>

              {!hasExistingConnection && (
                <button
                  type="button"
                  onClick={handleSaveConnection}
                  disabled={savingConnection || loadingProfile}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {savingConnection ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {savingConnection ? 'Saving...' : 'Save Connection'}
                </button>
              )}
            </div>

            {hasExistingConnection && (
              <p className="text-xs text-slate-400 mt-2">Your API connection is locked securely. To modify or transfer credentials, please submit an official request to Yogi Desk Admin Support.</p>
            )}
          </section>

          <div className="sticky bottom-4 z-10 rounded-3xl border border-slate-100 bg-white/95 p-4 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                {loadingProfile ? (
                  <>
                    <Loader2 className="animate-spin text-orange-600" size={16} />
                    Loading settings...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="text-emerald-600" size={16} />
                    Ready to save changes.
                  </>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || loadingProfile}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
