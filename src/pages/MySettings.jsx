import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bot, CheckCircle2, Clock, Edit3, IndianRupee, Loader2, Lock, Mail, MapPin, MessageSquare, Phone, Plus, Save, ShieldCheck, Smartphone, Sparkles, Stethoscope, Trash2, User } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  QUICK_REPLY_VARIABLES,
  readQuickReplies,
  sanitizeQuickReplyBody,
  sanitizeQuickReplyRecord,
  sanitizeQuickReplyText,
  validateQuickReplyRecord,
  writeQuickReplies,
} from '../utils/quickReplies';
import { startMetaEmbeddedSignup } from '../utils/metaEmbeddedSignup';

const emptyForm = {
  name: '',
  email: '',
  whatsappPhoneNumberId: '',
  whatsappBusinessAccountId: '',
  whatsappAccessToken: '',
};

const emptyKnowledgeBaseForm = {
  clinic_timing: '',
  consultation_fees: '',
  clinic_location: '',
  services_offered: '',
};

const emptyQuickReplyForm = {
  title: '',
  keywords: '',
  body: '',
};

const supportedAutomationMediaTypes = {
  text: ['text/plain'],
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/3gpp'],
  document: ['application/pdf'],
};

const emptyAutomationConfig = {
  welcome: {
    enabled: false,
    body: '',
    media_type: 'text',
    media_mime_type: 'text/plain',
    media_url: '',
  },
  businessHours: {
    enabled: false,
    start_time: '09:00',
    end_time: '18:00',
    days: 'mon_sat',
    body: '',
  },
  delayedResponse: {
    enabled: false,
    delay_minutes: '5',
    body: '',
  },
};

const sanitizeKnowledgeBaseValue = (value, maxLength = 1200) => String(value || '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/[<>`]/g, '')
  .replace(/\$\{/g, '{')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const sanitizeAutomationText = (value, maxLength = 1200) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/[<>`]/g, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\$\{/g, '{')
  .replace(/\s+/g, ' ')
  .trimStart()
  .slice(0, maxLength);

const sanitizeAutomationUrl = (value) => {
  const safeValue = sanitizeAutomationText(value, 600).trim();
  if (!safeValue) return '';
  if (!/^https?:\/\//i.test(safeValue)) return '';
  return safeValue;
};

const getAutomationCacheKey = (workspaceId) => `yogidesk_smart_automation_${String(workspaceId || 'default').replace(/[^\w-]/g, '') || 'default'}`;
const readAutomationConfig = (workspaceId) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(getAutomationCacheKey(workspaceId)) || 'null');
    return parsed ? {
      welcome: { ...emptyAutomationConfig.welcome, ...(parsed.welcome || {}) },
      businessHours: { ...emptyAutomationConfig.businessHours, ...(parsed.businessHours || {}) },
      delayedResponse: { ...emptyAutomationConfig.delayedResponse, ...(parsed.delayedResponse || {}) },
    } : emptyAutomationConfig;
  } catch {
    return emptyAutomationConfig;
  }
};

const isKnowledgeBaseEmpty = (data = {}) => Object.keys(emptyKnowledgeBaseForm)
  .every((key) => !String(data[key] || '').trim());

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
  const [connectingEmbeddedSignup, setConnectingEmbeddedSignup] = useState(false);
  const [loadingKnowledgeBase, setLoadingKnowledgeBase] = useState(true);
  const [savingKnowledgeBase, setSavingKnowledgeBase] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('account');
  const [isEditing, setIsEditing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [hasExistingConnection, setHasExistingConnection] = useState(false);
  const [metaValidationError, setMetaValidationError] = useState('');
  const [connectionAnimation, setConnectionAnimation] = useState(null);
  const [toast, setToast] = useState(null);
  const [accountAuthUser, setAccountAuthUser] = useState(null);
  const [passwordSetup, setPasswordSetup] = useState({ password: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [knowledgeBaseForm, setKnowledgeBaseForm] = useState(emptyKnowledgeBaseForm);
  const [quickReplyManagerOpen, setQuickReplyManagerOpen] = useState(false);
  const [quickReplyActiveTab, setQuickReplyActiveTab] = useState('quick_replies');
  const [quickReplyWorkspaceId, setQuickReplyWorkspaceId] = useState('');
  const [quickReplies, setQuickReplies] = useState([]);
  const [quickReplyForm, setQuickReplyForm] = useState(emptyQuickReplyForm);
  const [quickReplyError, setQuickReplyError] = useState('');
  const [automationConfig, setAutomationConfig] = useState(emptyAutomationConfig);
  const [automationError, setAutomationError] = useState('');
  const { user: authContextUser, userProfile, loadUserProfile, isMetaReviewSession } = useAuth();
  const lastSavedMetaRef = useRef(null);
  const lastHydratedMetaRef = useRef('');
  const hydratingMetaRef = useRef(false);
  const quickReplyBodyRef = useRef(null);
  const isMetaActive = Boolean(userProfile?.whatsapp_business_id || userProfile?.meta_configured);
  const isConfigured = isMetaActive || hasExistingConnection;
  const metaInputsLocked = isConfigured;
  const quickReplyTabs = [
    { id: 'quick_replies', label: 'Quick Replies' },
    !isMetaReviewSession && { id: 'smart_automation', label: 'Smart Automation', isNew: true },
  ].filter(Boolean);
  const activeAuthUser = accountAuthUser || authContextUser;
  const accountProviders = [
    ...(Array.isArray(activeAuthUser?.app_metadata?.providers) ? activeAuthUser.app_metadata.providers : []),
    activeAuthUser?.app_metadata?.provider,
    ...(Array.isArray(activeAuthUser?.identities) ? activeAuthUser.identities.map((identity) => identity.provider) : []),
  ].filter(Boolean).map((provider) => String(provider).toLowerCase());
  const showPasswordSetup = accountProviders.includes('google') && !accountProviders.includes('email');

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
    if (authUser?.id) setAccountAuthUser(authUser);
    const userId = authUser?.id || storedAccount.userId;
    if (!userId) throw new Error('Unable to identify the current account.');

    return {
      authUser: authUser || { id: userId, email: storedAccount.email },
      userId,
    };
  };

  const loadQuickReplies = async () => {
    try {
      const { userId } = await getActiveAccount();
      setQuickReplyWorkspaceId(userId);
      setQuickReplies(readQuickReplies(userId));
      setAutomationConfig(readAutomationConfig(userId));
    } catch {
      setQuickReplyWorkspaceId('default');
      setQuickReplies(readQuickReplies('default'));
      setAutomationConfig(readAutomationConfig('default'));
    }
  };

  useEffect(() => {
    if (isMetaReviewSession && quickReplyActiveTab !== 'quick_replies') {
      setQuickReplyActiveTab('quick_replies');
    }
  }, [isMetaReviewSession, quickReplyActiveTab]);

  useEffect(() => {
    loadQuickReplies();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateQuickReplyField = (field, value) => {
    setQuickReplyError('');
    setQuickReplyForm((current) => ({
      ...current,
      [field]: field === 'body'
        ? sanitizeQuickReplyBody(value)
        : sanitizeQuickReplyText(value, field === 'title' ? 40 : 240),
    }));
  };

  const persistAutomationConfig = (nextConfig) => {
    const workspaceId = quickReplyWorkspaceId || 'default';
    localStorage.setItem(getAutomationCacheKey(workspaceId), JSON.stringify(nextConfig));
    setAutomationConfig(nextConfig);
  };

  const updateAutomationSection = (section, patch) => {
    setAutomationError('');
    setAutomationConfig((current) => {
      const nextSection = { ...(current[section] || {}), ...patch };
      const nextConfig = { ...current, [section]: nextSection };
      localStorage.setItem(getAutomationCacheKey(quickReplyWorkspaceId || 'default'), JSON.stringify(nextConfig));
      return nextConfig;
    });
  };

  const updateAutomationText = (section, value, maxLength = 1200) => {
    updateAutomationSection(section, { body: sanitizeAutomationText(value, maxLength) });
  };

  const updateWelcomeMediaType = (mediaType) => {
    const safeType = Object.prototype.hasOwnProperty.call(supportedAutomationMediaTypes, mediaType) ? mediaType : 'text';
    updateAutomationSection('welcome', {
      media_type: safeType,
      media_mime_type: supportedAutomationMediaTypes[safeType][0],
      media_url: safeType === 'text' ? '' : automationConfig.welcome.media_url,
    });
  };

  const updateWelcomeMimeType = (mimeType) => {
    const allowed = supportedAutomationMediaTypes[automationConfig.welcome.media_type] || supportedAutomationMediaTypes.text;
    if (!allowed.includes(mimeType)) {
      setAutomationError('Selected media format is not supported for this message type.');
      return;
    }
    updateAutomationSection('welcome', { media_mime_type: mimeType });
  };

  const updateWelcomeMediaUrl = (value) => {
    updateAutomationSection('welcome', { media_url: sanitizeAutomationUrl(value) });
  };

  const saveAutomationConfig = () => {
    const mediaType = automationConfig.welcome.media_type;
    const allowed = supportedAutomationMediaTypes[mediaType] || [];
    if (!allowed.includes(automationConfig.welcome.media_mime_type)) {
      setAutomationError('Selected media format is not supported for this message type.');
      return;
    }
    persistAutomationConfig(automationConfig);
    setAutomationError('');
    showToast('success', 'Smart automation settings saved.');
  };

  const insertQuickReplyVariable = (token) => {
    if (!QUICK_REPLY_VARIABLES.includes(token)) return;
    const textarea = quickReplyBodyRef.current;
    const currentBody = quickReplyForm.body || '';
    const start = textarea?.selectionStart ?? currentBody.length;
    const end = textarea?.selectionEnd ?? start;
    const nextBody = sanitizeQuickReplyBody(`${currentBody.slice(0, start)}${token}${currentBody.slice(end)}`);
    setQuickReplyForm((current) => ({ ...current, body: nextBody }));
    window.requestAnimationFrame(() => {
      textarea?.focus();
      const nextCursor = Math.min(start + token.length, nextBody.length);
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const saveQuickReply = () => {
    const candidate = sanitizeQuickReplyRecord({
      ...quickReplyForm,
      id: `qr_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const validation = validateQuickReplyRecord(candidate, quickReplies);
    if (!validation.ok) {
      setQuickReplyError(validation.message);
      return;
    }

    const nextReplies = writeQuickReplies(quickReplyWorkspaceId || 'default', [validation.record, ...quickReplies]);
    setQuickReplies(nextReplies);
    setQuickReplyForm(emptyQuickReplyForm);
    setQuickReplyError('');
    showToast('success', 'Quick reply saved securely.');
  };

  const deleteQuickReply = (replyId) => {
    const safeId = sanitizeQuickReplyText(replyId, 80).replace(/[^\w-]/g, '');
    const nextReplies = writeQuickReplies(
      quickReplyWorkspaceId || 'default',
      quickReplies.filter((reply) => reply.id !== safeId)
    );
    setQuickReplies(nextReplies);
    showToast('success', 'Quick reply removed.');
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

  const loadKnowledgeBase = async () => {
    setLoadingKnowledgeBase(true);
    try {
      const res = await api.get('/api/settings/knowledge-base');
      const data = res.data?.data || {};
      setKnowledgeBaseForm({
        clinic_timing: data.clinic_timing || '',
        consultation_fees: data.consultation_fees || '',
        clinic_location: data.clinic_location || '',
        services_offered: data.services_offered || '',
      });
      setIsEditing(isKnowledgeBaseEmpty(data));
    } catch {
      showToast('error', 'Unable to load AI Knowledge Base.');
    } finally {
      setLoadingKnowledgeBase(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBase();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const updateKnowledgeBaseField = (field, value) => {
    setKnowledgeBaseForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveKnowledgeBase = async (event) => {
    event.preventDefault();
    setSavingKnowledgeBase(true);

    try {
      const payload = {
        clinic_timing: sanitizeKnowledgeBaseValue(knowledgeBaseForm.clinic_timing, 500),
        consultation_fees: sanitizeKnowledgeBaseValue(knowledgeBaseForm.consultation_fees, 250),
        clinic_location: sanitizeKnowledgeBaseValue(knowledgeBaseForm.clinic_location, 1000),
        services_offered: sanitizeKnowledgeBaseValue(knowledgeBaseForm.services_offered, 1200),
      };

      const res = await api.put('/api/settings/knowledge-base', payload);
      if (!res.data?.success) throw new Error('Knowledge base save was not confirmed.');

      setKnowledgeBaseForm(payload);
      setIsEditing(false);
      showToast('success', 'AI Knowledge Base updated successfully! Your custom Yogidesk ai Assistant is now synchronised and live.');
    } catch (error) {
      showToast('error', error?.response?.data?.message || 'Unable to save AI Knowledge Base.');
    } finally {
      setSavingKnowledgeBase(false);
    }
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

  const handleSetAccountPassword = async () => {
    const password = passwordSetup.password;
    if (password.length < 8) {
      showToast('error', 'Password must be at least 8 characters.');
      return;
    }
    if (password !== passwordSetup.confirmPassword) {
      showToast('error', 'Confirm password does not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      if (data?.user) setAccountAuthUser(data.user);
      setPasswordSetup({ password: '', confirmPassword: '' });
      showToast('success', 'Account password set successfully. You can now login with email and password.');
    } catch (error) {
      showToast('error', error.message || 'Unable to set account password.');
    } finally {
      setSavingPassword(false);
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
      console.error('Supabase Settings Sync Error: redacted connection save failure.');
      playConnectionAnimation('error');
      showToast('error', error?.response?.data?.message || error.message || 'Failed to update connection settings. Please try again.');
    } finally {
      setSavingConnection(false);
    }
  };

  const handleEmbeddedSignupConnection = async () => {
    if (isConfigured) {
      showToast('success', 'WhatsApp is already connected.');
      return;
    }

    setConnectingEmbeddedSignup(true);
    setMetaValidationError('');

    try {
      const signupResult = await startMetaEmbeddedSignup({
        appId: import.meta.env.VITE_META_APP_ID,
        configId: import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID,
      });
      const res = await api.post('/settings/meta-embedded-signup/complete', signupResult);
      if (!res.data?.success) throw new Error(res.data?.message || 'Unable to save WhatsApp connection.');

      const data = res.data?.data || {};
      const savedMeta = {
        whatsappPhoneNumberId: data.meta_phone_number_id || signupResult.phoneNumberId || '',
        whatsappBusinessAccountId: data.meta_waba_id || signupResult.businessAccountId || '',
        whatsappAccessToken: 'CONFIGURED',
        isConnected: true,
      };
      lastSavedMetaRef.current = savedMeta;
      const { userId: activeUserId } = await getActiveAccount();
      writeCachedMetaConnection(activeUserId, savedMeta);
      localStorage.removeItem('yogidesk_whatsapp_onboarding_prompt');
      setConnectionStatus('connected');
      setHasExistingConnection(true);
      playConnectionAnimation('success');
      await hydrateProfile({ force: true });
      showToast('success', 'WhatsApp connected successfully.');
    } catch (error) {
      playConnectionAnimation('error');
      setMetaValidationError(error?.response?.data?.message || error.message || 'WhatsApp connection failed.');
      showToast('error', error?.response?.data?.message || error.message || 'WhatsApp connection failed.');
    } finally {
      setConnectingEmbeddedSignup(false);
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
                ? 'Your business messaging credentials are saved and locked.'
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
                Configure your workspace profile and smart automated assistant protocols.
              </p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-lg shadow-orange-200">
              <ShieldCheck size={28} />
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-sm sm:flex-row">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('account')}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              activeSettingsTab === 'account'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-100'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck size={18} />
            Account & Meta
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('knowledge-base')}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              activeSettingsTab === 'knowledge-base'
                ? 'bg-orange-600 text-white shadow-md shadow-orange-100'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Bot size={18} />
            AI Knowledge Base
          </button>
        </div>

        {activeSettingsTab === 'account' ? (
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

          {showPasswordSetup && (
            <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm shadow-orange-100/70 sm:p-8">
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                    <Lock size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-950">Set Account Password</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Your account was created with Google. Add a password to login with email in the future.
                    </p>
                  </div>
                </div>
                <span className="inline-flex w-fit items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-orange-700">
                  Google account
                </span>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      value={passwordSetup.password}
                      onChange={(event) => setPasswordSetup((current) => ({ ...current, password: event.target.value }))}
                      placeholder="Minimum 8 characters"
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Confirm Password</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      value={passwordSetup.confirmPassword}
                      onChange={(event) => setPasswordSetup((current) => ({ ...current, confirmPassword: event.target.value }))}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-500">
                  Google login will continue working after this password is added.
                </p>
                <button
                  type="button"
                  onClick={handleSetAccountPassword}
                  disabled={savingPassword || loadingProfile}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {savingPassword ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                  {savingPassword ? 'Setting...' : 'Set Password'}
                </button>
              </div>
            </section>
          )}

          {!isMetaReviewSession && (
          <section className="rounded-3xl border border-orange-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <Smartphone size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Official Business Messaging Connection</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Connect through Meta's secure embedded signup. No manual IDs or tokens are required.
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
                {isConnected ? 'Connected' : 'Not connected yet'}
              </span>
            </div>

            {isConfigured && (
              <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#111827]">WhatsApp is connected</p>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    Locked for safety. Contact Customer Support for changes.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={refreshMetaConnection}
                    disabled={loadingProfile}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#FF6B00] transition hover:bg-orange-50 disabled:opacity-60 sm:w-auto"
                  >
                    Refresh from DB
                  </button>
                  <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-[#111827] sm:w-auto">
                    <Lock size={14} />
                    Locked
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-100 bg-[#111827] p-5 text-white">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-black uppercase tracking-widest text-orange-300">
                    {isConfigured ? 'Secure connection active' : 'Action required'}
                  </p>
                  <h3 className="mt-2 text-lg font-black">
                    {isConfigured ? 'Your clinic WhatsApp is ready for Yogi Desk.' : 'Connect WhatsApp to activate campaigns, templates, and inbox automation.'}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                    Meta opens in a secure popup and returns the connection to Yogi Desk automatically.
                  </p>
                </div>
                {!isConfigured && (
                  <button
                    type="button"
                    onClick={handleEmbeddedSignupConnection}
                    disabled={connectingEmbeddedSignup || loadingProfile}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-950/30 transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                  >
                    {connectingEmbeddedSignup ? <Loader2 className="animate-spin" size={18} /> : <Smartphone size={18} />}
                    {connectingEmbeddedSignup ? 'Connecting...' : 'Connect WhatsApp'}
                  </button>
                )}
              </div>
            </div>

            {metaValidationError && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {metaValidationError}
              </div>
            )}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm font-semibold text-orange-800 sm:flex-1">
                Your connection is stored securely. Raw Meta IDs and tokens are hidden from dashboard users.
              </div>
            </div>
          </section>
          )}

          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6B00] ring-1 ring-orange-100">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Clinic Quick Replies</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    Saved slash shortcuts for manual inbox replies.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickReplyManagerOpen((value) => !value)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-95 sm:w-auto"
              >
                <Sparkles size={18} />
                Manage Quick Replies
              </button>
            </div>

            {quickReplyManagerOpen && (
              <div className="mt-6">
                <div className="flex border-b border-slate-100">
                  {quickReplyTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setQuickReplyActiveTab(tab.id)}
                      className={`relative flex items-center px-4 py-3 text-sm font-black transition ${
                        quickReplyActiveTab === tab.id ? 'text-slate-950' : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {tab.label}
                      {tab.isNew && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#FFD701] rounded animate-pulse">NEW</span>
                      )}
                      <span className={`absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[#FF6B00] transition-all ${
                        quickReplyActiveTab === tab.id ? 'opacity-100' : 'opacity-0'
                      }`} />
                    </button>
                  ))}
                </div>

                {quickReplyActiveTab === 'quick_replies' ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50 sm:p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Short-key Title</label>
                      <input
                        type="text"
                        value={quickReplyForm.title}
                        onChange={(event) => updateQuickReplyField('title', event.target.value)}
                        placeholder="e.g., location, fees, consult_time"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Keywords Filter</label>
                      <input
                        type="text"
                        value={quickReplyForm.keywords}
                        onChange={(event) => updateQuickReplyField('keywords', event.target.value)}
                        placeholder="e.g., location clinic dmch, address consult, fees clinic doctor"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                      />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Template Body</label>
                      <div className="flex flex-wrap gap-2">
                        {QUICK_REPLY_VARIABLES.map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() => insertQuickReplyVariable(token)}
                            className="rounded-full border border-[#FF6B00] bg-orange-50/50 px-3 py-1.5 text-[10px] font-black text-slate-800 shadow-sm transition hover:bg-orange-100 active:scale-95"
                          >
                            {token}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      ref={quickReplyBodyRef}
                      value={quickReplyForm.body}
                      onChange={(event) => updateQuickReplyField('body', event.target.value)}
                      placeholder="e.g., Our clinic is located at DMCH Patna. Map link: http://maps.google.com/?q=0..., Consultation fees is ₹500."
                      rows={7}
                      maxLength={1024}
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                    />
                    <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-400">
                      <span>{quickReplyForm.body.length}/1024 chars</span>
                      <span>Variables resolve server-side at dispatch.</span>
                    </div>
                  </div>

                  {quickReplyError && (
                    <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">
                      {quickReplyError}
                    </div>
                  )}

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={saveQuickReply}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-95 sm:w-auto"
                    >
                      <Plus size={18} />
                      Add Quick Reply
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Saved Replies</h3>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-100">{quickReplies.length}/50</span>
                  </div>
                  <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                    {quickReplies.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
                        No quick replies saved yet.
                      </div>
                    ) : quickReplies.map((reply) => (
                      <div key={reply.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-orange-100 hover:bg-white hover:shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">/{reply.title}</p>
                            <p className="mt-1 truncate text-[11px] font-bold text-[#FF6B00]">{reply.keywords}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteQuickReply(reply.id)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 transition hover:bg-orange-50 hover:text-[#FF6B00] active:scale-95"
                            aria-label={`Delete ${reply.title} quick reply`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <p className="mt-3 line-clamp-3 text-xs font-semibold leading-5 text-slate-600">{reply.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
                ) : (
                  <div className="mt-6 space-y-5">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">Welcome Message Setup</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">Auto-trigger greeting for new patient conversations.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-3">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{automationConfig.welcome.enabled ? 'Enabled' : 'Disabled'}</span>
                          <input
                            type="checkbox"
                            checked={automationConfig.welcome.enabled}
                            onChange={(event) => updateAutomationSection('welcome', { enabled: event.target.checked })}
                            className="h-5 w-5 rounded border-slate-300 accent-[#FF6B00]"
                          />
                        </label>
                      </div>
                      <textarea
                        value={automationConfig.welcome.body}
                        onChange={(event) => updateAutomationText('welcome', event.target.value, 1200)}
                        placeholder="e.g., Namaste! Yogi Desk AI Clinic mein aapka swagat hai. Please share your name and health issue."
                        rows={4}
                        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                      />
                      <div className="mt-4 grid gap-3 md:grid-cols-[180px_220px_1fr]">
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media Type</span>
                          <select
                            value={automationConfig.welcome.media_type}
                            onChange={(event) => updateWelcomeMediaType(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                          >
                            <option value="text">text</option>
                            <option value="image">image</option>
                            <option value="video">video</option>
                            <option value="document">document</option>
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Format</span>
                          <select
                            value={automationConfig.welcome.media_mime_type}
                            onChange={(event) => updateWelcomeMimeType(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                          >
                            {(supportedAutomationMediaTypes[automationConfig.welcome.media_type] || supportedAutomationMediaTypes.text).map((mimeType) => (
                              <option key={mimeType} value={mimeType}>{mimeType}</option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Media Link</span>
                          <input
                            type="url"
                            value={automationConfig.welcome.media_url}
                            onChange={(event) => updateWelcomeMediaUrl(event.target.value)}
                            disabled={automationConfig.welcome.media_type === 'text'}
                            placeholder="Paste image/document link (e.g., clinic brochure, clinic video introduction)"
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">Out of Office / Business Hours</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">Clinic closed message for inactive hours.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-3">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{automationConfig.businessHours.enabled ? 'Enabled' : 'Disabled'}</span>
                          <input
                            type="checkbox"
                            checked={automationConfig.businessHours.enabled}
                            onChange={(event) => updateAutomationSection('businessHours', { enabled: event.target.checked })}
                            className="h-5 w-5 rounded border-slate-300 accent-[#FF6B00]"
                          />
                        </label>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Time</span>
                          <input
                            type="time"
                            value={automationConfig.businessHours.start_time}
                            onChange={(event) => updateAutomationSection('businessHours', { start_time: sanitizeAutomationText(event.target.value, 8) })}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Time</span>
                          <input
                            type="time"
                            value={automationConfig.businessHours.end_time}
                            onChange={(event) => updateAutomationSection('businessHours', { end_time: sanitizeAutomationText(event.target.value, 8) })}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Days</span>
                          <select
                            value={automationConfig.businessHours.days}
                            onChange={(event) => updateAutomationSection('businessHours', { days: sanitizeAutomationText(event.target.value, 20) })}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                          >
                            <option value="mon_sat">Mon-Sat</option>
                            <option value="mon_fri">Mon-Fri</option>
                            <option value="all_days">All Days</option>
                            <option value="weekends">Weekends</option>
                          </select>
                        </label>
                      </div>
                      <textarea
                        value={automationConfig.businessHours.body}
                        onChange={(event) => updateAutomationText('businessHours', event.target.value, 1200)}
                        placeholder="e.g., Right now our clinic is closed. Our active timings are Mon-Sat, 9AM to 6PM. For medical emergency, call 98765xxxxx."
                        rows={4}
                        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                      />
                    </div>

                    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">Delayed Response Alert</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">Staff busy message after a waiting threshold.</p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center gap-3">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-400">{automationConfig.delayedResponse.enabled ? 'Enabled' : 'Disabled'}</span>
                          <input
                            type="checkbox"
                            checked={automationConfig.delayedResponse.enabled}
                            onChange={(event) => updateAutomationSection('delayedResponse', { enabled: event.target.checked })}
                            className="h-5 w-5 rounded border-slate-300 accent-[#FF6B00]"
                          />
                        </label>
                      </div>
                      <label className="mt-4 block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delay Threshold</span>
                        <select
                          value={automationConfig.delayedResponse.delay_minutes}
                          onChange={(event) => updateAutomationSection('delayedResponse', { delay_minutes: sanitizeAutomationText(event.target.value, 2) })}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100 md:w-64"
                        >
                          <option value="5">After 5 Mins</option>
                          <option value="10">After 10 Mins</option>
                          <option value="15">After 15 Mins</option>
                        </select>
                      </label>
                      <textarea
                        value={automationConfig.delayedResponse.body}
                        onChange={(event) => updateAutomationText('delayedResponse', event.target.value, 1200)}
                        placeholder="e.g., We are experiencing high patient volumes at the clinic counter right now. Thank you for your patience, we will text you shortly!"
                        rows={4}
                        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                      />
                    </div>

                    {automationError && (
                      <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">
                        {automationError}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={saveAutomationConfig}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-95 sm:w-auto"
                      >
                        <Save size={18} />
                        Save Automation
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
        ) : (
        <form onSubmit={handleSaveKnowledgeBase} className="space-y-6">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                  <Bot size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">AI Knowledge Base</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Your smart assistant uses this clinic-specific information only for your workspace.
                  </p>
                </div>
              </div>
              {loadingKnowledgeBase && (
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  <Loader2 className="animate-spin" size={14} />
                  Loading
                </span>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Clinic Timings</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-4 text-slate-400" size={18} />
                  <textarea
                    value={knowledgeBaseForm.clinic_timing}
                    onChange={(event) => updateKnowledgeBaseField('clinic_timing', event.target.value)}
                    placeholder="Mon-Sat: 10 AM - 2 PM"
                    rows={4}
                    readOnly={!isEditing}
                    className={`w-full resize-none rounded-2xl border py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-50 ${
                      isEditing ? 'border-slate-200 bg-slate-50' : 'border-emerald-100 bg-emerald-50/50 text-slate-700'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Consultation Fees</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={knowledgeBaseForm.consultation_fees}
                    onChange={(event) => updateKnowledgeBaseField('consultation_fees', event.target.value)}
                    placeholder="Rs. 500"
                    readOnly={!isEditing}
                    className={`w-full rounded-2xl border py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-50 ${
                      isEditing ? 'border-slate-200 bg-slate-50' : 'border-emerald-100 bg-emerald-50/50 text-slate-700'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Clinic Location / Address</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-slate-400" size={18} />
                  <textarea
                    value={knowledgeBaseForm.clinic_location}
                    onChange={(event) => updateKnowledgeBaseField('clinic_location', event.target.value)}
                    placeholder="1st Floor, Jha Complex..."
                    rows={5}
                    readOnly={!isEditing}
                    className={`w-full resize-none rounded-2xl border py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-50 ${
                      isEditing ? 'border-slate-200 bg-slate-50' : 'border-emerald-100 bg-emerald-50/50 text-slate-700'
                    }`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Services Offered</label>
                <div className="relative">
                  <Stethoscope className="absolute left-4 top-4 text-slate-400" size={18} />
                  <textarea
                    value={knowledgeBaseForm.services_offered}
                    onChange={(event) => updateKnowledgeBaseField('services_offered', event.target.value)}
                    placeholder="Root Canal, Teeth Whitening, Braces..."
                    rows={5}
                    readOnly={!isEditing}
                    className={`w-full resize-none rounded-2xl border py-3 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-50 ${
                      isEditing ? 'border-slate-200 bg-slate-50' : 'border-emerald-100 bg-emerald-50/50 text-slate-700'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              {isEditing ? (
                <button
                  type="submit"
                  disabled={savingKnowledgeBase || loadingKnowledgeBase}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  {savingKnowledgeBase ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {savingKnowledgeBase ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  disabled={loadingKnowledgeBase}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                >
                  <Edit3 size={18} />
                  Edit Settings
                </button>
              )}
            </div>
          </section>
        </form>
        )}
      </div>
    </div>
  );
};

export default Settings;
