import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Facebook,
  Gift,
  Megaphone,
  PieChart,
  Send,
  Shield,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ensureWallet, MESSAGE_RATES, saveWallet } from '../utils/wallet';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_BASELINE_BALANCE = 1000;
const STARTER_LIMIT = 500;

const normalizeRole = (role) => (role || localStorage.getItem('user_role') || 'STAFF').toUpperCase();
const normalizeSupabaseId = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.id || value.user_id || value.sub || '').trim();
  return String(value || '').trim();
};
const isCleanFilterValue = (value) => Boolean(value && value !== 'undefined' && value !== 'null' && value !== '[object Object]');
const toMoneyNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};
const formatDoctorName = (name = 'Doctor') => {
  const cleanName = String(name || 'Doctor').trim();
  return /^dr\.?\s/i.test(cleanName) ? cleanName : `Dr. ${cleanName}`;
};
const getGreetingPhrase = (name = 'Doctor') => {
  const currentHour = new Date().getHours();
  if (currentHour >= 5 && currentHour < 12) return `Good morning, ${formatDoctorName(name)} ☀️`;
  if (currentHour >= 12 && currentHour < 17) return `Good afternoon, ${formatDoctorName(name)} 🌤️`;
  return `Good evening, ${formatDoctorName(name)} 🌙`;
};
const backendPath = (path) => String(api.defaults?.baseURL || '').replace(/\/+$/, '').endsWith('/api')
  ? path.replace(/^\/api/, '')
  : path;
const getStartOfDay = (date = new Date()) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};
const addDays = (date, days) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};
const getStartOfWeek = (date = new Date()) => {
  const value = getStartOfDay(date);
  const mondayOffset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - mondayOffset);
  return value;
};
const sumCampaignRows = (rows = []) => rows.reduce((total, row) => (
  total + Number(row.sent_count ?? row.total_recipients ?? row.count ?? 1)
), 0);
const countRowsByDay = (rows = [], days = []) => {
  const map = new Map(days.map((day) => [day.key, { ...day, total: 0 }]));
  rows.forEach((row) => {
    const createdAt = row.created_at || row.sent_at;
    const date = createdAt ? new Date(createdAt) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    const existing = map.get(key);
    if (!existing) return;
    existing.total += Number(row.sent_count ?? row.total_recipients ?? 1) || 0;
  });
  return Array.from(map.values());
};
const safeFetch = async (operation, fallback) => {
  try {
    return await operation();
  } catch (error) {
    console.warn('Dashboard data dependency skipped:', error?.message || error);
    return fallback;
  }
};
const buildSevenDayWindow = () => {
  const today = getStartOfDay();
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    return {
      key: date.toISOString().slice(0, 10),
      label: DAY_LABELS[date.getDay()],
      fullLabel: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      date,
      total: 0,
    };
  });
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-black text-slate-900">{label}</p>
      <p className="font-semibold text-orange-600">{payload[0].value} messages sent</p>
    </div>
  );
};

const PerformanceBarChart = ({ data }) => {
  return (
    <div className="h-72 rounded-md border border-slate-100 bg-white px-3 pb-2 pt-5">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 800 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 700 }} />
          <Tooltip cursor={{ fill: '#fff7ed' }} content={<ChartTooltip />} />
          <Bar dataKey="total" fill="#ff6b00" radius={[6, 6, 0, 0]} maxBarSize={72} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};

const TemplateStatusRing = ({ approved, pending, rejected }) => {
  const total = approved + pending + rejected;
  const approvedPct = total ? (approved / total) * 100 : 0;
  const pendingPct = total ? (pending / total) * 100 : 0;
  const rejectedPct = total ? (rejected / total) * 100 : 0;
  const ring = `conic-gradient(#22c55e 0 ${approvedPct}%, #eab308 ${approvedPct}% ${approvedPct + pendingPct}%, #ef4444 ${approvedPct + pendingPct}% ${approvedPct + pendingPct + rejectedPct}%, #f1f5f9 ${approvedPct + pendingPct + rejectedPct}% 100%)`;

  return (
    <div className="flex items-center gap-8">
      <div className="relative h-36 w-36 rounded-full" style={{ background: ring }}>
        <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white">
          <span className="text-3xl font-black text-slate-950">{total}</span>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500" /><span className="text-slate-600">Approved ({approved})</span></div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /><span className="text-slate-600">Rejected ({rejected})</span></div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-yellow-500" /><span className="text-slate-600">Pending ({pending})</span></div>
      </div>
    </div>
  );
};

const DashboardHome = () => {
  const navigate = useNavigate();
  const category = localStorage.getItem('user_business_category') || 'Clinic';
  const [wallet, setWallet] = useState(() => ensureWallet({ welcomeGift: true }));
  const [walletBalance, setWalletBalance] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isDashboardInitialized, setIsDashboardInitialized] = useState(false);
  const [profile, setProfile] = useState({
    role: normalizeRole(),
    name: localStorage.getItem('user_name') || 'Doctor',
  });
  const [stats, setStats] = useState({
    weeklySent: 0,
    lastWeekSent: 0,
    leadsToday: 0,
    ghostMode: false,
    lifetimePatients: 0,
    patientLimit: STARTER_LIMIT,
    leakageCount: 0,
    peakWindow: 'No response traffic yet',
  });
  const [templateStats, setTemplateStats] = useState({ approved: 0, pending: 0, rejected: 0 });
  const [messageHistory, setMessageHistory] = useState(() => buildSevenDayWindow());
  const [guidedTour, setGuidedTour] = useState({ open: false, step: 0 });

  useEffect(() => {
    const storageKey = 'dashboard_greeting_shown';
    const todayKey = new Date().toISOString().slice(0, 10);
    if (!isDashboardInitialized) return;
    if (localStorage.getItem(storageKey) === todayKey) return;
    localStorage.setItem(storageKey, todayKey);
    const timer = window.setTimeout(() => setShowWelcome(true), 0);
    return () => window.clearTimeout(timer);
  }, [isDashboardInitialized]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      const meta = user?.user_metadata || {};
      const userId = normalizeSupabaseId(user?.id || localStorage.getItem('user_id'));
      const role = normalizeRole(meta.role || meta.user_role || meta.account_role);
      const name = meta.staff_name || meta.full_name || meta.name || user?.email || localStorage.getItem('user_name') || 'Doctor';

      if (active) setProfile({ role, name });
      if (!isCleanFilterValue(userId)) return;

      const todayStart = getStartOfDay();
      const weekStart = getStartOfWeek();
      const lastWeekStart = addDays(weekStart, -7);
      const nextWeekStart = addDays(weekStart, 7);
      const sevenDays = buildSevenDayWindow();
      const sevenDayStart = sevenDays[0].date;
      const tomorrowStart = addDays(todayStart, 1);

      const [
        walletResult,
        trialProfileResult,
        usageResult,
        leadsTodayResult,
        currentCampaignRows,
        previousCampaignRows,
        sevenDayCampaignRows,
        inboxWeeklyRows,
        inboxPreviousRows,
        sevenDayInboxRows,
        templateRows,
        leakageRows,
        inboundRows,
      ] = await Promise.all([
        safeFetch(
          () => supabase.from('wallets').select('balance,is_first_recharge,welcome_gift_active').eq('user_id', userId).maybeSingle(),
          { data: null }
        ),
        safeFetch(
          () => api.get(backendPath('/api/profile/trial'), { params: { userId } }),
          { data: null }
        ),
        safeFetch(
          () => api.get(backendPath('/api/user/usage'), { params: { userId } }),
          { data: null }
        ),
        safeFetch(
          () => supabase
            .from('patients_ledger')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', todayStart.toISOString())
            .lt('created_at', tomorrowStart.toISOString()),
          { count: 0 }
        ),
        safeFetch(
          () => supabase
            .from('campaign_analytics')
            .select('id,sent_count,total_recipients,created_at,status')
            .eq('user_id', userId)
            .gte('created_at', weekStart.toISOString())
            .lt('created_at', nextWeekStart.toISOString()),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('campaign_analytics')
            .select('id,sent_count,total_recipients,created_at,status')
            .eq('user_id', userId)
            .gte('created_at', lastWeekStart.toISOString())
            .lt('created_at', weekStart.toISOString()),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('campaign_analytics')
            .select('id,sent_count,total_recipients,created_at,status')
            .eq('user_id', userId)
            .gte('created_at', sevenDayStart.toISOString())
            .lt('created_at', tomorrowStart.toISOString()),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('inbox_messages')
            .select('id,created_at,from_me,status')
            .eq('workspace_id', userId)
            .eq('from_me', true)
            .gte('created_at', weekStart.toISOString())
            .lt('created_at', nextWeekStart.toISOString()),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('inbox_messages')
            .select('id,created_at,from_me,status')
            .eq('workspace_id', userId)
            .eq('from_me', true)
            .gte('created_at', lastWeekStart.toISOString())
            .lt('created_at', weekStart.toISOString()),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('inbox_messages')
            .select('id,created_at,from_me,status')
            .eq('workspace_id', userId)
            .eq('from_me', true)
            .gte('created_at', sevenDayStart.toISOString())
            .lt('created_at', tomorrowStart.toISOString()),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('submitted_meta_templates')
            .select('status')
            .eq('user_id', userId),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('inbox_messages')
            .select('id,status,created_at,metadata')
            .eq('workspace_id', userId)
            .eq('from_me', true)
            .gte('created_at', lastWeekStart.toISOString())
            .in('status', ['SENT', 'sent', 'DELIVERED', 'delivered', 'COMPLETED', 'completed']),
          { data: [] }
        ),
        safeFetch(
          () => supabase
            .from('inbox_messages')
            .select('id,created_at,from_me,sender,status')
            .eq('workspace_id', userId)
            .eq('from_me', false)
            .gte('created_at', sevenDayStart.toISOString()),
          { data: [] }
        ),
      ]);

      if (!active) return;

      if (walletResult?.data) {
        const savedWallet = saveWallet(walletResult.data);
        setWallet(savedWallet);
        setWalletBalance(toMoneyNumber(savedWallet.balance));
      }

      const tourCompleted = trialProfileResult?.data?.profile?.onboarding_tour_completed;
      const localTourCompleted = localStorage.getItem(`onboarding_tour_completed_${userId}`) === 'true';
      if (tourCompleted === false && !localTourCompleted) {
        setGuidedTour({ open: true, step: 0 });
      }

      const currentRows = Array.isArray(currentCampaignRows?.data) ? currentCampaignRows.data : [];
      const previousRows = Array.isArray(previousCampaignRows?.data) ? previousCampaignRows.data : [];
      const weeklyCampaignTotal = sumCampaignRows(currentRows);
      const weeklyInboxTotal = Array.isArray(inboxWeeklyRows?.data) ? inboxWeeklyRows.data.length : 0;
      const weeklySent = weeklyCampaignTotal || weeklyInboxTotal;
      const previousInboxTotal = Array.isArray(inboxPreviousRows?.data) ? inboxPreviousRows.data.length : 0;
      const lastWeekSent = sumCampaignRows(previousRows) || previousInboxTotal;

      const templates = Array.isArray(templateRows?.data) ? templateRows.data : [];
      const approvedCount = templates.filter((t) => t.status === 'APPROVED').length;
      const pendingCount = templates.filter((t) => t.status === 'PENDING_APPROVAL' || t.status === 'PENDING').length;
      const rejectedCount = templates.filter((t) => t.status === 'REJECTED').length;
      setTemplateStats({ approved: approvedCount, pending: pendingCount, rejected: rejectedCount });

      const campaignHistoryRows = Array.isArray(sevenDayCampaignRows?.data) ? sevenDayCampaignRows.data : [];
      const inboxHistoryRows = Array.isArray(sevenDayInboxRows?.data) ? sevenDayInboxRows.data : [];
      const historyRows = campaignHistoryRows.length ? campaignHistoryRows : inboxHistoryRows;
      setMessageHistory(countRowsByDay(historyRows, sevenDays));

      const inbound = Array.isArray(inboundRows?.data) ? inboundRows.data : [];
      const hourCounts = inbound.reduce((acc, row) => {
        const hour = new Date(row.created_at).getHours();
        if (Number.isFinite(hour)) acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});
      const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const peakWindow = peakHour === undefined
        ? 'No response traffic yet'
        : `${Number(peakHour) % 12 || 12} ${Number(peakHour) >= 12 ? 'PM' : 'AM'} - ${(Number(peakHour) + 3) % 12 || 12} ${Number(peakHour) + 3 >= 12 && Number(peakHour) + 3 < 24 ? 'PM' : 'AM'}`;

      setStats({
        weeklySent,
        lastWeekSent,
        leadsToday: leadsTodayResult?.count || 0,
        ghostMode: false,
        lifetimePatients: Number(usageResult?.data?.lifetime_patients_count || 0),
        patientLimit: Number(usageResult?.data?.limit || STARTER_LIMIT),
        leakageCount: Array.isArray(leakageRows?.data) ? leakageRows.data.length : 0,
        peakWindow,
      });
      setIsDashboardInitialized(true);
    };

    loadDashboard();
    return () => { active = false; };
  }, []);

  const isStaff = profile.role === 'STAFF';
  const walletPercent = Math.min(100, Math.max(0, (walletBalance / WEEK_BASELINE_BALANCE) * 100));
  const walletTone = walletBalance >= 700
    ? 'bg-emerald-500'
    : walletBalance >= 200
      ? 'bg-amber-500'
      : 'bg-red-500 animate-pulse';
  const isLowWallet = walletBalance < 200;
  const weeklyTrendUp = stats.weeklySent >= stats.lastWeekSent;
  const totalTemplates = templateStats.approved + templateStats.pending + templateStats.rejected;
  const chartTotal = useMemo(() => messageHistory.reduce((total, item) => total + Number(item.total || 0), 0), [messageHistory]);
  const tourSteps = [
    {
      title: 'Connect Meta configurations',
      body: 'Add your WhatsApp phone number ID, WABA ID, and system token so Yogi Desk can send approved clinical messages.',
      action: 'Open Settings',
      path: '/dashboard/settings',
    },
    {
      title: 'Append a recipient',
      body: 'Add one patient contact to your workspace. This gives your clinic a real test recipient before larger broadcasts.',
      action: 'Add Patient',
      path: '/dashboard/contacts',
    },
    {
      title: 'Hit a quick test transmission',
      body: 'Use a pre-approved template and send a controlled test message before inviting the rest of your team.',
      action: 'Open Templates',
      path: '/templates',
    },
  ];
  const closeGuidedTour = async ({ completed = false } = {}) => {
    const { data } = await supabase.auth.getUser().catch(() => ({ data: null }));
    const userId = normalizeSupabaseId(data?.user?.id || localStorage.getItem('user_id'));
    if (isCleanFilterValue(userId)) {
      localStorage.setItem(`onboarding_tour_completed_${userId}`, String(completed));
      if (completed) {
        api.post(backendPath('/api/profile/onboarding-tour-complete'), { userId }).catch(() => {});
      }
    }
    setGuidedTour({ open: false, step: 0 });
  };

  return (
    <div className="space-y-8 pb-10">
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-white">
              <Sparkles size={28} />
            </div>
            <h2 className="mt-5 text-2xl font-black text-slate-900">{getGreetingPhrase(profile.name)}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {isLowWallet
                ? 'Your wallet balance is currently low. Please top up your credits to ensure uninterrupted automated patient broadcasts and alerts.'
                : 'Yogi Desk is fully active. You have active analytics and patients awaiting care updates today.'}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {isLowWallet ? (
                <Link to="/dashboard/wallet" className="inline-flex w-full justify-center rounded-2xl bg-orange-600 px-4 py-3 text-sm font-black text-white transition hover:bg-orange-700 sm:w-auto">
                  Recharge Wallet
                </Link>
              ) : (
                <button
                  type="button"
                  className="inline-flex w-full justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 sm:w-auto"
                  onClick={() => {
                    setShowWelcome(false);
                    document.getElementById('dashboard-analytics-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  View Daily Analytics
                </button>
              )}
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                onClick={() => setShowWelcome(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {guidedTour.open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-xl rounded-t-[2rem] border border-orange-100 bg-white p-6 shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-600">Guided onboarding</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">{tourSteps[guidedTour.step].title}</h2>
              </div>
              <button
                type="button"
                onClick={() => closeGuidedTour({ completed: false })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
              >
                Skip
              </button>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">{tourSteps[guidedTour.step].body}</p>
            <div className="mt-5 flex gap-2">
              {tourSteps.map((step, index) => (
                <div key={step.title} className={`h-2 flex-1 rounded-full ${index <= guidedTour.step ? 'bg-orange-600' : 'bg-slate-100'}`} />
              ))}
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  const current = tourSteps[guidedTour.step];
                  navigate(current.path);
                }}
                className="rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-black text-orange-700 hover:bg-orange-100"
              >
                {tourSteps[guidedTour.step].action}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (guidedTour.step >= tourSteps.length - 1) {
                    closeGuidedTour({ completed: true });
                    return;
                  }
                  setGuidedTour((current) => ({ ...current, step: current.step + 1 }));
                }}
                className="rounded-2xl bg-[#FF6A00] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 hover:bg-orange-600"
              >
                {guidedTour.step >= tourSteps.length - 1 ? 'Finish Tour' : 'Next Step'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-normal text-slate-950">Namaste, {formatDoctorName(profile.name)}</h1>
          <p className="mt-1 text-slate-500">Here is your {category} workspace performance.</p>
          {!isStaff && wallet.welcome_gift_active && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <Gift size={16} />
              Welcome Gift: Rs. 50.00 Free WhatsApp Credits Active
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 ${stats.ghostMode ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
            <Shield size={18} />
            <span className="text-sm font-bold">{stats.ghostMode ? 'Ghost Mode Active' : 'Ghost Mode Off'}</span>
          </div>
          <Link to="/campaigns" className="flex items-center justify-center gap-2 rounded-md bg-[#FF6B00] px-6 py-3 font-bold text-white shadow-lg shadow-orange-200/50 transition hover:-translate-y-0.5 hover:bg-orange-600">
            <Zap size={20} /> New Broadcast
          </Link>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${isStaff ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-500">Messages Sent (This Week)</p>
              <h3 className="text-3xl font-black text-slate-950">{stats.weeklySent.toLocaleString()}</h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Send size={24} /></div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black ${weeklyTrendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {weeklyTrendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {weeklyTrendUp ? 'High vs last week' : 'Low vs last week'}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">Last week: {stats.lastWeekSent.toLocaleString()} messages</p>
        </div>

        {!isStaff && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">Wallet Balance</p>
                <h3 className="text-3xl font-black text-slate-950">Rs. {walletBalance.toFixed(2)}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Wallet size={22} /></div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all duration-700 ${walletTone}`} style={{ width: `${walletPercent}%` }} />
            </div>
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-500">Lifetime Patients</p>
              <h3 className="text-3xl font-black text-slate-950">{stats.lifetimePatients}/{stats.patientLimit || STARTER_LIMIT}</h3>
              <span className="mt-1 block text-xs text-slate-400">New today: {stats.leadsToday}</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600"><Users size={24} /></div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="white-card p-6">
          <h3 className="mb-6 flex items-center gap-2 text-lg font-black text-slate-900"><PieChart size={20} className="text-slate-400" /> WhatsApp Template Status</h3>
          <TemplateStatusRing approved={templateStats.approved} pending={templateStats.pending} rejected={templateStats.rejected} />
          <div className="mt-6 rounded-md bg-slate-50 p-4 text-xs font-semibold text-slate-500">
            {totalTemplates} templates tracked from submitted Meta template records.
          </div>
        </div>

        <div className="white-card overflow-hidden p-0 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-6">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Facebook size={20} className="text-blue-600" /> Live Ad Campaigns</h3>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">COMING SOON - BETA TESTING</span>
          </div>
          <div className="p-6">
            <div className="relative min-h-[220px] overflow-hidden rounded-md border border-slate-100 bg-slate-950 p-6 text-white">
              <div className="absolute inset-0 opacity-70 blur-[1px]">
                <div className="grid h-full grid-cols-8 items-end gap-3 px-8 pb-8">
                  {[52, 78, 45, 88, 66, 94, 72, 83].map((height, index) => (
                    <div key={height + index} className="rounded-t-md bg-gradient-to-t from-blue-500 to-emerald-300" style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="absolute right-10 top-8 h-20 w-48 rounded-md border border-white/10 bg-white/10" />
                <div className="absolute left-10 top-10 h-12 w-32 rounded-md border border-white/10 bg-white/10" />
              </div>
              <div className="relative max-w-xl rounded-md border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black text-orange-100">
                  <Megaphone size={14} /> COMING SOON - BETA TESTING
                </div>
                <h3 className="text-2xl font-black">Meta Ads Lead Generation Framework</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-200">Launch high-conversion Google & Facebook clinic ads instantly from Yogi Desk. Unlock automated ROI mapping.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="dashboard-analytics-section" className="white-card p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><BarChart3 size={20} className="text-orange-500" /> Message Sent History (Last 7 Days)</h3>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">{chartTotal.toLocaleString()} total messages</span>
        </div>
        <PerformanceBarChart data={messageHistory} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="white-card border-l-4 border-l-red-500 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-red-50 text-red-600"><AlertTriangle size={24} /></div>
            <div>
              <p className="text-xs font-black uppercase text-red-600">Revenue Leakage Widget</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">⚠️ {stats.leakageCount} Patients missed follow-ups. Recover lost clinic bookings now.</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">Outbound reminders without a confirmed follow-up are flagged for recovery outreach.</p>
            </div>
          </div>
        </div>

        <div className="white-card border-l-4 border-l-orange-500 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-orange-50 text-orange-600"><Clock3 size={24} /></div>
            <div>
              <p className="text-xs font-black uppercase text-orange-600">Peak Patient Response Hour Widget</p>
              <h3 className="mt-2 text-xl font-black text-slate-950">🔥 Peak engagement time: {stats.peakWindow}</h3>
              <p className="mt-2 text-sm font-medium text-slate-500">Schedule broadcasts around the busiest incoming patient response window.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
