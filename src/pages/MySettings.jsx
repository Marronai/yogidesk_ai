import React, { useEffect, useState } from 'react';
import { Loader2, Mail, Phone, Save, ShieldCheck, Smartphone, User } from 'lucide-react';
import axios from 'axios';
import { supabase } from '../config/supabaseClient';

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappAccessToken: '',
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const user = res.data || {};

        let connectionValues = {
          whatsappPhoneNumberId: '',
          whatsappBusinessAccountId: '',
          whatsappAccessToken: '',
        };

        try {
          const { data: authData } = await supabase.auth.getUser();
          const supabaseUserId = authData?.user?.id || localStorage.getItem('user_id');
          if (supabaseUserId) {
            const { data } = await supabase
              .from('users')
              .select('whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token')
              .eq('id', supabaseUserId)
              .single();

            if (data) {
              connectionValues = {
                whatsappPhoneNumberId: data.whatsapp_phone_number_id || '',
                whatsappBusinessAccountId: data.whatsapp_business_account_id || '',
                whatsappAccessToken: data.whatsapp_access_token || '',
              };
            }
          }
        } catch (err) {
          console.warn('Unable to fetch Supabase connection settings:', err.message || err);
        }

        setFormData({
          name: user.name || '',
          email: user.email || '',
          ...connectionValues,
        });
        setConnectionStatus(
          connectionValues.whatsappPhoneNumberId && connectionValues.whatsappBusinessAccountId && connectionValues.whatsappAccessToken
            ? 'connected'
            : 'disconnected'
        );
      } catch (err) {
        console.error('Failed to load user data:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserData();
  }, []);

  const updateField = (field, value) => {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:5000/api/settings/update', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert('Settings saved successfully.');
    } catch (err) {
      alert(err.response?.data?.msg || 'Update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    setSavingConnection(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const userId = authData?.user?.id || localStorage.getItem('user_id');
      if (!userId) throw new Error('Unable to identify the current user. Please sign in again.');

      const { error } = await supabase.from('users').upsert(
        {
          id: userId,
          whatsapp_phone_number_id: formData.whatsappPhoneNumberId || null,
          whatsapp_business_account_id: formData.whatsappBusinessAccountId || null,
          whatsapp_access_token: formData.whatsappAccessToken || null,
        },
        { onConflict: 'id' }
      );

      if (error) throw error;

      setConnectionStatus(
        formData.whatsappPhoneNumberId && formData.whatsappBusinessAccountId && formData.whatsappAccessToken
          ? 'connected'
          : 'disconnected'
      );
      alert('WhatsApp connection saved to your Supabase profile.');
    } catch (err) {
      alert(err.message || 'Unable to save connection details.');
    } finally {
      setSavingConnection(false);
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="min-h-screen bg-orange-50/30 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-[2rem] bg-white border border-orange-100 px-5 py-6 shadow-sm sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">Yogi Desk</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Settings</h1>
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
          <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
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
                    onChange={(e) => updateField('name', e.target.value)}
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
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Official Meta API Connection</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Add your clinic doctor’s Meta WhatsApp Cloud credentials here.
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                  isConnected
                    ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                    : 'border-slate-200 bg-slate-100 text-slate-600'
                }`}
              >
                {isConnected ? '🟢 Connected to your Meta Cloud' : '⚠️ Not connected yet'}
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
                    onChange={(e) => updateField('whatsappPhoneNumberId', e.target.value)}
                    placeholder="Enter your WhatsApp Phone Number ID"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp Business Account ID</label>
                <input
                  type="text"
                  value={formData.whatsappBusinessAccountId}
                  onChange={(e) => updateField('whatsappBusinessAccountId', e.target.value)}
                  placeholder="Enter your WABA ID"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">System User Access Token</label>
                <input
                  type="password"
                  value={formData.whatsappAccessToken}
                  onChange={(e) => updateField('whatsappAccessToken', e.target.value)}
                  placeholder="EAAMz..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-orange-800">
                Your WhatsApp credentials are stored per doctor and used by the campaign engine for authenticated Meta Cloud dispatch.
              </div>

              <button
                type="button"
                onClick={handleSaveConnection}
                disabled={savingConnection || loadingProfile}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {savingConnection ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {savingConnection ? 'Saving...' : 'Save Connection'}
              </button>
            </div>
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
