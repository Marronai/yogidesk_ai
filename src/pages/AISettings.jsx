import React, { useEffect, useMemo, useState } from 'react';
import { Bot, CreditCard, Gauge, PauseCircle, RefreshCw, Settings2, ShieldCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';

const defaultSettings = {
  plan: '',
  plan_tier: '',
  runtime_plan: '',
  has_trial_expired: false,
  is_trial_expired: false,
  aiEnabled: false,
  tokenLimit: 0,
  tokenUsed: 0,
  isAiPaused: false,
};

const AISettings = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTrialExpiredModal, setShowTrialExpiredModal] = useState(false);

  const usagePercent = useMemo(() => {
    const locked = settings.has_trial_expired || settings.is_trial_expired || String(settings.runtime_plan || settings.plan_tier || settings.plan || '').toLowerCase() === 'basic';
    if (locked) return 0;
    const limit = Number(settings.tokenLimit || 0);
    if (!limit) return 0;
    return Math.min(100, Math.round((Number(settings.tokenUsed || 0) / limit) * 100));
  }, [settings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const { data: userResult } = await supabase.auth.getUser();
      const userId = userResult?.user?.id || localStorage.getItem('user_id');
      const [settingsResult, profileResult] = await Promise.all([
        api.get('/api/ai/settings', { params: { userId } }),
        api.get('/profile/context', { params: { userId } }).catch(() => ({ data: null })),
      ]);
      if (settingsResult.data?.success) {
        const liveProfile = profileResult.data?.profile || userProfile || {};
        const livePlan = liveProfile.runtime_plan || liveProfile.current_plan || liveProfile.plan_tier;
        const expired = Boolean(liveProfile.has_trial_expired || liveProfile.is_trial_expired || settingsResult.data.settings?.has_trial_expired || settingsResult.data.settings?.is_trial_expired);
        setSettings({
          ...defaultSettings,
          ...(settingsResult.data.settings || {}),
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

  useEffect(() => {
    loadSettings();
  }, []);

  const planLabel = String(settings.runtime_plan || settings.plan_tier || settings.plan || 'growth').replace(/_/g, ' ');
  const isLocked = settings.has_trial_expired || settings.is_trial_expired || planLabel.toLowerCase() === 'basic';
  const assistantEnabled = settings.aiEnabled && !settings.isAiPaused && !isLocked;
  const displayTokenLimit = isLocked ? 0 : Number(settings.tokenLimit || 0);
  const displayTokenUsed = isLocked ? 0 : Number(settings.tokenUsed || 0);
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
              Your 7-day complementary trial period has expired. Please recharge your wallet balance under the billing view to activate YogiDesk AI features again.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/wallet')}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white hover:bg-orange-700"
            >
              <CreditCard size={18} />
              Open Billing
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
          onClick={loadSettings}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
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
            {isLocked ? 'Your complementary access has expired. Recharge wallet balance to restore assistant automation.' : settings.aiEnabled ? 'Assistant automation is enabled for this workspace.' : 'Assistant automation is not enabled on this plan.'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Gauge size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">AI Usage</p>
                <p className="text-sm font-bold text-slate-700">Tokens/Messages Used: {displayTokenUsed} / {displayTokenLimit}</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{usagePercent}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${usagePercent}%` }} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/pricing')}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 hover:bg-orange-700"
          >
            <CreditCard size={18} />
            Recharge / Upgrade Limit
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
            Plan limits, disabled automation, exhausted usage, and human takeover all route patients to the inbox for manual reply.
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
    </div>
  );
};

export default AISettings;
