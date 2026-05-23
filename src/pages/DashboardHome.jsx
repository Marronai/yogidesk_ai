import React, { useEffect, useState } from 'react';
import {
  Facebook,
  Gift,
  PieChart,
  Send,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ensureWallet, MESSAGE_RATES, saveWallet } from '../utils/wallet';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';

const normalizeRole = (role) => (role || localStorage.getItem('user_role') || 'STAFF').toUpperCase();
const normalizeSupabaseId = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.id || value.user_id || value.sub || '').trim();
  return String(value || '').trim();
};
const isCleanFilterValue = (value) => Boolean(value && value !== 'undefined' && value !== 'null' && value !== '[object Object]');
const toFilterIsoString = (date) => {
  const value = date instanceof Date ? date : new Date(date);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
};
const formatDoctorName = (name = 'Doctor') => {
  const cleanName = String(name || 'Doctor').trim();
  return /^dr\.?\s/i.test(cleanName) ? cleanName : `Dr. ${cleanName}`;
};

const DashboardHome = () => {
  const category = localStorage.getItem('user_business_category') || 'Clinic';
  const [wallet, setWallet] = useState(() => ensureWallet({ welcomeGift: true }));
  const [walletBalance, setWalletBalance] = useState(0);
  const [stats, setStats] = useState({ weekly_sent: 0, leads_today: 0, ghost_mode: false });
  const [usage, setUsage] = useState({ lifetime_patients_count: 0, limit: 500 });
  const [profile, setProfile] = useState({
    role: normalizeRole(),
    name: localStorage.getItem('user_name') || 'Doctor',
  });
  const backendPath = (path) => String(api.defaults?.baseURL || '').replace(/\/+$/, '').endsWith('/api') ? path.replace(/^\/api/, '') : path;

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const meta = data?.user?.user_metadata || {};
      const userId = normalizeSupabaseId(data?.user?.id || localStorage.getItem('user_id'));
      const role = normalizeRole(meta.role || meta.user_role || meta.account_role);
      const name = meta.staff_name || meta.full_name || meta.name || data?.user?.email || profile.name;
      if (active) setProfile({ role, name });
      if (!isCleanFilterValue(userId)) return;

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const weekStartIso = toFilterIsoString(weekStart);
      const todayStartIso = toFilterIsoString(todayStart);
      if (!weekStartIso || !todayStartIso) return;

      const refreshWalletBalance = async () => {
        try {
          const response = await api.get('/api/wallet/balance', { params: { userId } });
          if (active && response.data.success) {
            setWalletBalance(response.data.balance);
          }
        } catch (err) {
          console.error("Wallet sync error:", err);
        }
      };

      const results = await Promise.allSettled([
        supabase.from('wallets').select('balance,is_first_recharge,welcome_gift_active').eq('user_id', userId).maybeSingle(),
        supabase.from('campaign_queue').select('id', { count: 'exact', head: false }).eq('user_id', userId).eq('status', 'SENT').gte('sent_at', weekStartIso),
        supabase.from('patients_ledger').select('id', { count: 'exact', head: false }).eq('user_id', userId).gte('created_at', todayStartIso),
        api.get(backendPath('/api/user/usage'), { params: { userId } }).catch(() => ({ data: null }))
      ]);

      const walletResult = results[0]?.status === 'fulfilled' ? results[0].value : null;
      if (active && walletResult?.data) setWallet(saveWallet(walletResult.data));
      refreshWalletBalance();

      const sentResult = results[1]?.status === 'fulfilled' ? results[1].value : null;
      const leadResult = results[2]?.status === 'fulfilled' ? results[2].value : null;
      const usageResult = results[3]?.status === 'fulfilled' ? results[3].value : null;

      if (active) {
        setStats({
          weekly_sent: sentResult?.count || 0,
          leads_today: leadResult?.count || 0,
          ghost_mode: false
        });
        if (usageResult.data) {
          setUsage({
            lifetime_patients_count: Number(usageResult.data.lifetime_patients_count || 0),
            limit: Number(usageResult.data.limit || 500)
          });
        }
      }
    };
    loadProfile();
    return () => { active = false; };
  }, []);

  const isStaff = profile.role === 'STAFF';
  const liveCampaigns = [];
  const messageHistory = [0, 0, 0, 0, 0, 0, 0];

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Namaste, {formatDoctorName(profile.name)}</h1>
          <p className="text-gray-500 mt-1">Here is your {category} workspace performance.</p>
          {!isStaff && wallet.welcome_gift_active && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <Gift size={16} />
              Welcome Gift: Rs. 50.00 Free WhatsApp Credits Active
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${stats.ghost_mode ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 text-gray-500'}`}>
            <Shield size={18} className={stats.ghost_mode ? 'fill-purple-700' : ''} />
            <span className="text-sm font-bold">{stats.ghost_mode ? 'Ghost Mode Active' : 'Ghost Mode Off'}</span>
          </div>
          <Link to="/campaigns" className="bg-[#FF6B00] hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-orange-200/50 transition transform hover:-translate-y-0.5">
            <Zap size={20} /> New Broadcast
          </Link>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isStaff ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-6`}>
        <div className="white-card p-6 flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Messages Sent (This Week)</p>
            <h3 className="text-3xl font-extrabold text-gray-900">{stats.weekly_sent.toLocaleString()}</h3>
            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded flex w-fit mt-2">
              <TrendingUp size={12} className="mr-1" /> Live total
            </span>
          </div>
          <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Send size={28} /></div>
        </div>

        {!isStaff && (
          <div className="white-card p-6 flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-gray-500 text-sm font-medium">Wallet Balance</p>
              <h3 className="text-3xl font-extrabold text-gray-900">Rs. {walletBalance.toFixed(2)}</h3>
              </div>
              <div className="p-2 bg-orange-50 text-brand rounded-xl"><Wallet size={20} /></div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full" style={{ width: `${Math.min(100, walletBalance)}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-2 font-medium">Utility Rs. {MESSAGE_RATES.utility.toFixed(2)}/msg · Marketing Rs. {MESSAGE_RATES.marketing.toFixed(2)}/msg</p>
          </div>
        )}

        <div className="white-card p-6 flex items-center justify-between border-l-4 border-l-green-500">
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">Lifetime Patients</p>
            <h3 className="text-3xl font-extrabold text-gray-900">{usage.lifetime_patients_count}/{usage.limit || 500}</h3>
            <span className="text-xs text-gray-400 mt-1">New today: {stats.leads_today}</span>
          </div>
          <div className="p-4 bg-green-50 text-green-600 rounded-2xl"><Users size={28} /></div>
        </div>
      </div>

      {!isStaff && (
        <div className="white-card p-6 border border-orange-100 bg-orange-50">
          <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Prepaid Wallet Engine</h3>
              <p className="mt-2 text-sm text-gray-600 max-w-2xl">Your broadcasts are powered by prepaid WhatsApp credits. Recharge before campaigns to keep patient reminders and offers running.</p>
            </div>
            <Link to="/dashboard/wallet" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm">
              <Wallet size={18} /> Recharge Wallet
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500">Message Deduction Rules</p>
              <h4 className="mt-2 text-2xl font-bold text-gray-900">Pay per message</h4>
              <p className="mt-2 text-sm text-gray-500">Utility reminders cost Rs. {MESSAGE_RATES.utility.toFixed(2)} / msg. Marketing offers cost Rs. {MESSAGE_RATES.marketing.toFixed(2)} / msg.</p>
            </div>
            <div className="rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
              <p className="text-sm text-gray-500">Fixed Pricing</p>
              <h4 className="mt-2 text-2xl font-bold text-gray-900">Transparent rates</h4>
              <p className="mt-2 text-sm text-gray-500">Appointment reminders are fixed at Rs. 0.20/message. Promotional broadcasts are fixed at Rs. 1.30/message.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="white-card p-6 flex flex-col">
          <h3 className="font-bold text-gray-800 text-lg mb-6 flex items-center gap-2"><PieChart size={20} className="text-gray-400" /> WhatsApp Template Status</h3>
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32 rounded-full bg-slate-100">
              <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center"><span className="text-2xl font-bold text-gray-800">0</span></div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full" /><span className="text-gray-600">Approved (0)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full" /><span className="text-gray-600">Rejected (0)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 bg-yellow-500 rounded-full" /><span className="text-gray-600">Pending (0)</span></div>
            </div>
          </div>
          <div className="mt-6 bg-gray-50 p-3 rounded-lg text-xs text-gray-500">Tip: Use clinical, appointment-focused wording for faster template approvals.</div>
        </div>

        <div className="lg:col-span-2 white-card p-0 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><Facebook size={20} className="text-blue-600" /> Live Ad Campaigns</h3>
            <span className="text-xs bg-slate-100 text-slate-500 font-bold px-3 py-1 rounded-full">No active campaigns</span>
          </div>
          <div className="p-6 overflow-x-auto">
            <div className="min-w-[540px] grid gap-4">
              {(liveCampaigns || []).map(([title, meta, type, clicks, icon]) => (
                <div key={title} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-md transition bg-white">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">{type}</div>
                    <div><h4 className="font-bold text-gray-800">{title}</h4><p className="text-xs text-gray-500">{meta}</p></div>
                  </div>
                  <div className="text-right"><div className="text-xl font-bold text-gray-900">{clicks}</div><p className="text-xs text-gray-500">Clicks Today</p></div>
                  <button className="text-orange-500 hover:bg-orange-50 p-2 rounded-full">{icon}</button>
                </div>
              ))}
              {liveCampaigns.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">
                  No live ad campaigns yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="white-card p-6">
        <h3 className="font-bold text-gray-800 text-lg mb-6">Message Sent History (Last 7 Days)</h3>
        <div className="h-48 flex items-end justify-between gap-4 px-4">
          {(messageHistory || []).map((height, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-3 group">
              <div className="w-full bg-gray-100 rounded-t-lg relative h-full flex items-end overflow-hidden group-hover:bg-gray-200 transition">
                <div className="w-full bg-[#FF6B00] rounded-t-lg transition-all duration-700 ease-out group-hover:bg-orange-600" style={{ height: `${height}%` }} />
              </div>
              <span className="text-xs text-gray-400 font-bold">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
