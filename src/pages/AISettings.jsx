import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CreditCard, Gauge, PauseCircle, RefreshCw, Settings2, ShieldCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import AIUsagePassbook from '../components/AIUsagePassbook';

const INITIAL_AI_MESSAGE_CREDITS = 500;

const defaultSettings = {
  plan: '',
  plan_tier: '',
  runtime_plan: '',
  has_trial_expired: false,
  is_trial_expired: false,
  aiEnabled: false,
  tokenLimit: 0,
  tokenUsed: 0,
  aiMessageBalance: 0,
  aiMessageUsed: 0,
  isAiPaused: false,
};

const AISettings = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [usageLedgerLoading, setUsageLedgerLoading] = useState(true);
  const [aiUsageLedger, setAiUsageLedger] = useState([]);
  const [profileMeta, setProfileMeta] = useState({ clinicName: 'Clinic Workspace', clinicPhoneNumber: '' });
  const [error, setError] = useState('');
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);

  const usagePercent = useMemo(() => {
    const locked = settings.has_trial_expired || settings.is_trial_expired || String(settings.runtime_plan || settings.plan_tier || settings.plan || '').toLowerCase() === 'basic';
    if (locked) return 0;
    const balance = Number(settings.aiMessageBalance ?? settings.tokenLimit ?? 0);
    const used = Number(settings.aiMessageUsed ?? settings.tokenUsed ?? 0);
    const total = balance + used;
    if (!total) return 0;
    return Math.min(100, Math.round((used / total) * 100));
  }, [settings]);

  const sortedAiUsageLedger = useMemo(() => (
    [...aiUsageLedger].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
  ), [aiUsageLedger]);

  const resolveDashboardUserId = async () => {
    const { data: userResult } = await supabase.auth.getUser();
    return userResult?.user?.id || localStorage.getItem('user_id');
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const userId = await resolveDashboardUserId();
      const [settingsResult, profileResult] = await Promise.all([
        api.get('/api/ai/settings', { params: { userId } }),
        api.get('/profile/context', { params: { userId } }).catch(() => ({ data: null })),
      ]);
      if (settingsResult.data?.success) {
        const liveProfile = profileResult.data?.profile || userProfile || {};
        const liveSettings = settingsResult.data.settings || {};
        const currentAiMessageBalance = Number(liveSettings.ai_message_balance ?? liveSettings.aiMessageBalance ?? liveSettings.message_credit_balance ?? liveSettings.tokenLimit ?? 0);
        setProfileMeta({
          clinicName: liveProfile.clinic_name || liveProfile.business_name || liveProfile.clinicName || localStorage.getItem('clinic_name') || 'Clinic Workspace',
          clinicPhoneNumber: liveProfile.clinic_phone || liveProfile.phone || liveProfile.mobile || liveProfile.whatsapp_number || liveProfile.whatsapp_phone || localStorage.getItem('user_phone') || '',
        });
        const livePlan = liveProfile.runtime_plan || liveProfile.current_plan || liveProfile.plan_tier;
        const expired = Boolean(liveProfile.has_trial_expired || liveProfile.is_trial_expired || settingsResult.data.settings?.has_trial_expired || settingsResult.data.settings?.is_trial_expired);
        setSettings({
          ...defaultSettings,
          ...liveSettings,
          aiMessageBalance: currentAiMessageBalance,
          aiMessageUsed: Math.max(0, INITIAL_AI_MESSAGE_CREDITS - currentAiMessageBalance),
          ...(livePlan && { plan: livePlan, plan_tier: livePlan, runtime_plan: livePlan }),
          has_trial_expired: expired,
          is_trial_expired: expired,
        });
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to load AI settings.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAiUsageLedger = async () => {
    try {
      setUsageLedgerLoading(true);
      const userId = await resolveDashboardUserId();
      if (!userId) {
        setAiUsageLedger([]);
        return;
      }

      const { data } = await api.get('/api/wallet/transactions', {
        params: {
          userId,
          purpose: 'ai_usage_passbook',
        },
      });

      if (!data?.success) throw new Error(data?.message || 'Unable to load AI usage passbook.');
      setAiUsageLedger(data.transactions || []);
    } catch (usageError) {
      console.warn('AI usage passbook unavailable:', usageError?.message || usageError);
      setAiUsageLedger([]);
    } finally {
      setUsageLedgerLoading(false);
    }
  };

  const refreshAssistantDashboard = async () => {
    await Promise.all([
      loadSettings(),
      fetchAiUsageLedger(),
    ]);
  };

  useEffect(() => {
    refreshAssistantDashboard();
  }, []);

  useEffect(() => {
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') fetchAiUsageLedger();
    };
    window.addEventListener('focus', fetchAiUsageLedger);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      window.removeEventListener('focus', fetchAiUsageLedger);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, []);

  const planLabel = String(settings.runtime_plan || settings.plan_tier || settings.plan || 'growth').replace(/_/g, ' ');
  const isLocked = settings.has_trial_expired || settings.is_trial_expired || planLabel.toLowerCase() === 'basic';
  const assistantEnabled = settings.aiEnabled && !settings.isAiPaused && !isLocked;
  const displayMessageBalance = isLocked ? 0 : Number(settings.aiMessageBalance ?? settings.tokenLimit ?? 0);
  const displayMessageUsed = isLocked ? 0 : Number(settings.aiMessageUsed ?? settings.tokenUsed ?? 0);
  const displayPlanLabel = planLabel
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  useEffect(() => {
    if (isLocked) setShowTrialExpiredModal(true);
  }, [isLocked]);

  return (
    <div className="space-y-6">
      {showTrialExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-600">Trial Expired</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">YogiDesk AI is paused</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTrialExpiredModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                aria-label="Close trial expired notice"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
              Your 7-day complementary trial period has expired. Please recharge AI Assistant Messages to activate YogiDesk AI features again.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/ai-recharge')}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-orange-700"
            >
              <CreditCard size={18} />
              Recharge AI Messages
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <Bot size={26} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">AI Appointments</p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Assistant Settings</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={refreshAssistantDashboard}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading || usageLedgerLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShieldCheck size={22} />
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${assistantEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {assistantEnabled ? 'Active' : 'Paused'}
            </span>
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Current Plan</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{displayPlanLabel}</p>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            {isLocked ? 'Your complementary access has expired. Recharge AI Assistant Messages to restore assistant automation.' : settings.aiEnabled ? 'Assistant automation is enabled for this workspace.' : 'Assistant automation is not enabled on this plan.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Gauge size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">AI Message Credits</p>
                <p className="text-sm font-bold text-slate-700">AI Messages Used: {displayMessageUsed} | Available: {displayMessageBalance}</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{usagePercent}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${usagePercent}%` }} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/ai-recharge')}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 hover:bg-orange-700"
          >
            <CreditCard size={18} />
            Recharge AI Messages
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <Settings2 size={18} className="text-slate-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">Assistant Gate</h2>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-500">
            Plan access, disabled automation, exhausted AI Message Credits, and human takeover all route patients to the inbox for manual reply.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <PauseCircle size={18} className="text-slate-500" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-600">Human Takeover</h2>
          </div>
          <p className="text-sm font-semibold leading-6 text-slate-500">
            Use the live inbox header switch to pause or resume AI instantly while the doctor is chatting.
          </p>
        </div>
      </div>

      <AIUsagePassbook
        rows={sortedAiUsageLedger}
        loading={usageLedgerLoading}
        onRefresh={fetchAiUsageLedger}
        clinicName={profileMeta.clinicName}
        clinicPhoneNumber={profileMeta.clinicPhoneNumber}
        className="w-full"
      />
    </div>
  );
};

export default AISettings;
