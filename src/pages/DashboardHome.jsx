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
import { Link } from 'react-router-dom';
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
  const category = localStorage.getItem('user_business_category') || 'Clinic';
  const [wallet, setWallet] = useState(() => ensureWallet({ welcomeGift: true }));
  const [walletBalance, setWalletBalance] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
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

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

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
    };

    loadDashboard();
    return () => { active = false; };
  }, []);

  const isStaff = profile.role === 'STAFF';
  const walletPercent = Math.min(100, Math.max(0, (walletBalance / WEEK_BASELINE_BALANCE) * 100));
  const walletTone = walletBalance >= 700
    ? { fill: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Healthy credit runway' }
    : walletBalance >= 200
      ? { fill: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Recharge before a large broadcast' }
      : { fill: 'bg-red-500 animate-pulse', text: 'text-red-700', bg: 'bg-red-50', label: 'Low credits! Reminders may halt soon.' };
  const weeklyTrendUp = stats.weeklySent >= stats.lastWeekSent;
  const totalTemplates = templateStats.approved + templateStats.pending + templateStats.rejected;
  const chartTotal = useMemo(() => messageHistory.reduce((total, item) => total + Number(item.total || 0), 0), [messageHistory]);

  return (
    <div className="space-y-8 pb-10">
      {showWelcome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-4 backdrop-blur-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-md bg-orange-600 text-white shadow-xl shadow-orange-200 animate-bounce">
              <Sparkles size={30} />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Welcome to your dashboard</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Your clinic workspace is ready.</p>
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

      <div className={`grid grid-cols-1 gap-6 ${isStaff ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        <div className="white-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-500">Messages Sent (This Week)</p>
              <h3 className="text-4xl font-black text-slate-950">{stats.weeklySent.toLocaleString()}</h3>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-blue-50 text-blue-600"><Send size={30} /></div>
          </div>
          <div className={`mt-4 inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-black ${weeklyTrendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {weeklyTrendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {weeklyTrendUp ? 'High vs last week' : 'Low vs last week'}
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">Last week: {stats.lastWeekSent.toLocaleString()} messages</p>
        </div>

        {!isStaff && (
          <div className="white-card p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-500">Wallet Balance</p>
                <h3 className="text-4xl font-black text-slate-950">Rs. {walletBalance.toFixed(2)}</h3>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-50 text-orange-600"><Wallet size={22} /></div>
            </div>
            <div className="relative h-4 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all duration-700 ${walletTone.fill}`} style={{ width: `${walletPercent}%` }} />
              <div className="absolute left-[70%] top-0 h-full w-px bg-white/80" />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-black uppercase text-slate-400">
              <span>Rs. 0</span>
              <span>Baseline Rs. {WEEK_BASELINE_BALANCE.toFixed(2)}</span>
            </div>
            <div className={`mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-xs font-bold ${walletTone.bg} ${walletTone.text}`}>
              <span>{walletTone.label}</span>
              {walletBalance < 200 && <Link to="/dashboard/wallet" className="underline">Recharge Now</Link>}
            </div>
            <p className="mt-3 text-xs font-medium text-slate-500">Utility Rs. {MESSAGE_RATES.utility.toFixed(2)}/msg · Marketing Rs. {MESSAGE_RATES.marketing.toFixed(2)}/msg</p>
          </div>
        )}

        <div className="white-card border-l-4 border-l-green-500 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-sm font-semibold text-slate-500">Lifetime Patients</p>
              <h3 className="text-4xl font-black text-slate-950">{stats.lifetimePatients}/{stats.patientLimit || STARTER_LIMIT}</h3>
              <span className="mt-1 block text-xs text-slate-400">New today: {stats.leadsToday}</span>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-green-50 text-green-600"><Users size={30} /></div>
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

      <div className="white-card p-6">
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
