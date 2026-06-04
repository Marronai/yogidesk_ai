import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, Phone, Save, ShieldCheck, Smartphone, User } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
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

const metaCacheKey = (userId) => `yogidesk_meta_connection_${userId || 'default'}`;
const META_CACHE_TTL_MS = 60 * 1000;

const readCachedMetaConnection = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(metaCacheKey(userId)) || '{}');
  } catch {
    return {};
  }
};

const writeCachedMetaConnection = (userId, payload) => {
  if (!userId) return;
  localStorage.setItem(metaCacheKey(userId), JSON.stringify({
    whatsappPhoneNumberId: payload.whatsappPhoneNumberId || '',
    whatsappBusinessAccountId: payload.whatsappBusinessAccountId || '',
    whatsappAccessToken: payload.whatsappAccessToken || '',
    isConnected: true,
    savedAt: new Date().toISOString(),
  }));
};

const isFreshMetaCache = (cache = {}) => {
  const savedAt = new Date(cache.savedAt || 0).getTime();
  return Boolean(savedAt && Date.now() - savedAt < META_CACHE_TTL_MS);
};

const readMetaFields = (row = {}) => ({
  meta_phone_number_id: row.meta_phone_number_id || row.whatsapp_phone_number_id || row.phone_number_id || '',
  meta_waba_id: row.meta_waba_id || row.whatsapp_business_account_id || row.business_account_id || row.waba_id || '',
  system_user_token: row.system_user_token || row.whatsapp_access_token || '',
  meta_business_manager_id: row.meta_business_manager_id || row.meta_business_id || row.business_id || '',
});

const hasStoredMetaFields = (row = {}) => Boolean(
  readMetaFields(row).meta_phone_number_id ||
  readMetaFields(row).meta_waba_id ||
  readMetaFields(row).system_user_token
);

const fetchMetaConnectionFromSupabase = async (userId) => {
  if (!userId) return null;
  const tables = ['doctor_profiles', 'users', 'clinics'];
  const ownerColumns = ['id', 'user_id', 'doctor_id', 'auth_user_id'];

  for (const table of tables) {
    for (const column of ownerColumns) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq(column, userId)
          .limit(1)
          .maybeSingle();

        if (error) continue;
        if (data && hasStoredMetaFields(data)) {
          const metaFields = readMetaFields(data);
          return {
            ...data,
            ...metaFields,
            whatsapp_phone_number_id: metaFields.meta_phone_number_id,
            whatsapp_business_account_id: metaFields.meta_waba_id,
            system_user_token: metaFields.system_user_token ? 'CONFIGURED' : '',
            meta_configured: true,
            is_locked: true,
          };
        }
      } catch {
        // Try the next table/owner column pair.
      }
    }
  }

  return null;
};

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingConnection, setSavingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [hasExistingConnection, setHasExistingConnection] = useState(false);
  const [metaValidationError, setMetaValidationError] = useState('');
  const [connectionAnimation, setConnectionAnimation] = useState(null);
  const [toast, setToast] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const { userProfile, loadUserProfile } = useAuth();
  const lastSavedMetaRef = useRef(null);
  const lastHydratedMetaRef = useRef('');
  const hydratingMetaRef = useRef(false);
  const isMetaActive = Boolean(userProfile?.whatsapp_business_id || userProfile?.meta_configured);
  const isConfigured = isMetaActive || hasExistingConnection;
  const metaInputsLocked = isConfigured;

  const isNumericMetaId = (value) => /^\d+$/.test(String(value || '').trim());

  const validateMetaIds = ({ phoneNumberId, businessAccountId }) => {
    if (!isNumericMetaId(phoneNumberId)) {
      return 'WhatsApp Phone Number ID must contain numbers only.';
    }
    if (!isNumericMetaId(businessAccountId)) {
      return 'WhatsApp Business Account ID must contain numbers only.';
    }
    return '';
  };

  const showToast = (type, text) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3200);
  };

  const playConnectionAnimation = (type) => {
    setConnectionAnimation(type);
    window.setTimeout(() => setConnectionAnimation(null), 1800);
  };

  const getActiveAccount = async () => {
    const { data, error } = await supabase.auth.getUser();
    const storedAccount = getStoredAccount(); // This is a fallback, userId from context is preferred
    if (error && !storedAccount.userId) throw error;

    const authUser = data?.user || null;
    const userId = authUser?.id || storedAccount.userId;
    if (!userId) throw new Error('Unable to identify the current account.');

    return {
      authUser: authUser || { id: userId, email: storedAccount.email },
      userId,
    };
  };

  const hydrateProfile = async ({ force = false } = {}) => {
    if (hydratingMetaRef.current) return;
    hydratingMetaRef.current = true;
    setLoadingProfile(true);

    try {
      const { authUser, userId: activeUserId } = await getActiveAccount();
      if (!force && lastHydratedMetaRef.current === activeUserId) {
        return;
      }
      const profile = await loadUserProfile(activeUserId, { force: true });
      let fetchedData = profile || {};
      const cachedMeta = readCachedMetaConnection(activeUserId);
      const lastSavedMeta = lastSavedMetaRef.current || {};
      const hasUsableCachedMeta = Boolean(
        cachedMeta.isConnected &&
        cachedMeta.whatsappPhoneNumberId &&
        cachedMeta.whatsappBusinessAccountId
      );
      const shouldFetchMeta = force || !hasUsableCachedMeta || !isFreshMetaCache(cachedMeta);

      if (shouldFetchMeta) {
        try {
          const res = await api.get('/settings/meta-connection');
          fetchedData = {
            ...fetchedData,
            ...(res.data?.data || res.data || {}),
          };
        } catch (metaFetchError) {
          console.warn('Meta settings prefill fetch skipped:', metaFetchError?.message || metaFetchError);
        }
      }

      if (!hasStoredMetaFields(fetchedData) && !fetchedData.meta_configured && !fetchedData.is_locked) {
        const directMetaData = await fetchMetaConnectionFromSupabase(activeUserId);
        if (directMetaData) {
          fetchedData = {
            ...fetchedData,
            ...directMetaData,
          };
        }
      }

      const metaPhoneNumberId = fetchedData.whatsapp_phone_number_id
        || fetchedData.meta_phone_number_id
        || lastSavedMeta.whatsappPhoneNumberId
        || cachedMeta.whatsappPhoneNumberId
        || '';
      const metaWabaId = fetchedData.whatsapp_business_account_id
        || fetchedData.meta_waba_id
        || fetchedData.waba_id
        || lastSavedMeta.whatsappBusinessAccountId
        || cachedMeta.whatsappBusinessAccountId
        || '';
      const systemUserToken = fetchedData.system_user_access_token
        || fetchedData.system_user_token
        || fetchedData.whatsapp_access_token
        || lastSavedMeta.whatsappAccessToken
        || cachedMeta.whatsappAccessToken
        || '';
      const connectionExists = Boolean(
        fetchedData.meta_configured
        || fetchedData.is_locked
        || cachedMeta.isConnected
        || lastSavedMeta.isConnected
        || metaPhoneNumberId
        || metaWabaId
        || systemUserToken
      );

      const nextForm = {
        name: fetchedData.name || authUser?.user_metadata?.full_name || localStorage.getItem('user_name') || '',
        email: fetchedData.email || authUser?.email || localStorage.getItem('user_email') || '',
        whatsappPhoneNumberId: metaPhoneNumberId,
        whatsappBusinessAccountId: metaWabaId,
        whatsappAccessToken: systemUserToken || '',
      };

      setFormData((current) => ({
        ...current,
        name: nextForm.name || current.name,
        email: nextForm.email || current.email,
        whatsappPhoneNumberId: nextForm.whatsappPhoneNumberId || current.whatsappPhoneNumberId,
        whatsappBusinessAccountId: nextForm.whatsappBusinessAccountId || current.whatsappBusinessAccountId,
        whatsappAccessToken: nextForm.whatsappAccessToken || current.whatsappAccessToken,
      }));
      setHasExistingConnection(connectionExists);
      setConnectionStatus(
        connectionExists ? 'connected' : 'disconnected'
      );
      if (connectionExists) {
        writeCachedMetaConnection(activeUserId, {
          whatsappPhoneNumberId: metaPhoneNumberId,
          whatsappBusinessAccountId: metaWabaId,
          whatsappAccessToken: systemUserToken || cachedMeta.whatsappAccessToken || 'CONFIGURED',
        });
      }
      lastHydratedMetaRef.current = activeUserId;
    } catch {
      showToast('error', 'Failed to update connection settings. Please try again.');
    } finally {
      hydratingMetaRef.current = false;
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    hydrateProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  const refreshMetaConnection = async () => {
    try {
      const { userId } = await getActiveAccount();
      localStorage.removeItem(metaCacheKey(userId));
      lastHydratedMetaRef.current = '';
      await hydrateProfile({ force: true });
      showToast('success', 'Meta connection refreshed from database.');
    } catch {
      showToast('error', 'Unable to refresh Meta connection from database.');
    }
  };

  const updateField = (field, value) => {
    if (metaInputsLocked && ['whatsappPhoneNumberId', 'whatsappBusinessAccountId', 'whatsappAccessToken'].includes(field)) {
      return;
    }

    if (field === 'whatsappPhoneNumberId' || field === 'whatsappBusinessAccountId') {
      if (/[^\d]/.test(value)) {
        setMetaValidationError('Meta IDs must be numeric. Emails or names are not valid Meta IDs.');
      } else {
        setMetaValidationError('');
      }
    }

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
    if (isConfigured) {
      showToast('error', 'Meta credentials are locked. Contact Customer Support to modify your integration.');
      return;
    }
    const validationError = validateMetaIds({
      phoneNumberId: formData.whatsappPhoneNumberId,
      businessAccountId: formData.whatsappBusinessAccountId,
    });
    if (validationError) {
      setMetaValidationError(validationError);
      showToast('error', validationError);
      return;
    }
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

      const res = await api.post('/settings/meta-connection', payload);

      if (res.data && (res.data.success === true || res.status === 200)) {
        const savedMeta = {
          whatsappPhoneNumberId: payload.whatsappPhoneNumberId,
          whatsappBusinessAccountId: payload.whatsappBusinessAccountId,
          whatsappAccessToken: payload.whatsappAccessToken,
          isConnected: true,
        };
        lastSavedMetaRef.current = savedMeta;
        const { userId: activeUserId } = await getActiveAccount();
        writeCachedMetaConnection(activeUserId, savedMeta);
        try {
          await api.get('/templates/sync', { params: { userId: activeUserId } });
        } catch (syncError) {
          console.warn('Meta template refresh skipped:', syncError?.response?.data || syncError.message || syncError);
        }
        showToast('success', 'Meta credentials updated successfully!');
        playConnectionAnimation('success');
        setConnectionStatus('connected');
        setHasExistingConnection(true);
        setMetaValidationError('');
        setFormData((current) => ({
          ...current,
          whatsappPhoneNumberId: payload.whatsappPhoneNumberId,
          whatsappBusinessAccountId: payload.whatsappBusinessAccountId,
          whatsappAccessToken: payload.whatsappAccessToken,
        }));
      } else {
        playConnectionAnimation('error');
        showToast('error', 'Server did not confirm the Meta connection. Please try again.');
      }
    } catch (error) {
      console.error('Supabase Settings Sync Error:', error);
      playConnectionAnimation('error');
      showToast('error', error?.response?.data?.message || error.message || 'Failed to update connection settings. Please try again.');
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

      {connectionAnimation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-[2rem] border bg-white p-8 text-center shadow-2xl ${
            connectionAnimation === 'success' ? 'border-emerald-100 shadow-emerald-200' : 'border-red-100 shadow-red-200'
          }`}>
            <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${
              connectionAnimation === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
            }`}>
              {connectionAnimation === 'success' ? (
                <CheckCircle2 className="animate-in zoom-in duration-300" size={42} />
              ) : (
                <AlertCircle className="animate-in zoom-in duration-300" size={42} />
              )}
            </div>
            <h3 className="text-xl font-black text-slate-950">
              {connectionAnimation === 'success' ? 'Meta Connected' : 'Connection Failed'}
            </h3>
            <p className="mt-2 text-sm font-bold text-slate-500">
              {connectionAnimation === 'success'
                ? 'Your WhatsApp Cloud credentials are saved and locked.'
                : 'Please check the credentials and try again.'}
            </p>
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

            {isConfigured && (
              <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-emerald-800">Credentials loaded from database</p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700/80">
                    Locked for safety. Contact Customer Support for changes.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={refreshMetaConnection}
                    disabled={loadingProfile}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 sm:w-auto"
                  >
                    Refresh from DB
                  </button>
                  <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-700 sm:w-auto">
                    <Lock size={14} />
                    Locked
                  </div>
                </div>
              </div>
            )}

            <div className="relative">
              <div className={`grid gap-5 lg:grid-cols-2 ${metaInputsLocked ? 'pointer-events-none blur-[2px] select-none' : ''}`}>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp Phone Number ID</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.whatsappPhoneNumberId}
                      onChange={(event) => updateField('whatsappPhoneNumberId', event.target.value)}
                      disabled={metaInputsLocked}
                      placeholder="Enter your WhatsApp Phone Number ID"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">WhatsApp Business Account ID</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.whatsappBusinessAccountId}
                    onChange={(event) => updateField('whatsappBusinessAccountId', event.target.value)}
                    disabled={metaInputsLocked}
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
                    disabled={metaInputsLocked}
                    placeholder="EAAMz..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>

              {metaInputsLocked && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-white/45 backdrop-blur-[1px]">
                  <div className="rounded-3xl border border-emerald-200 bg-white/95 px-6 py-5 text-center shadow-xl shadow-emerald-100">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Lock size={28} />
                    </div>
                    <p className="mt-3 text-sm font-black text-slate-900">Meta credentials locked</p>
                  </div>
                </div>
              )}
            </div>

            {metaValidationError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {metaValidationError}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-orange-800 sm:flex-1">
                Your WhatsApp credentials are used for authenticated Meta Cloud dispatch across campaigns and templates.
              </div>

              {!metaInputsLocked && (
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
