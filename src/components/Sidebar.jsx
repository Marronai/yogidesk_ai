import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LayoutTemplate,
  LogOut,
  Megaphone,
  MessageSquare,
  Send,
  Settings,
  Users,
  Wallet,
  ChevronDown,
  Bot,
} from 'lucide-react';
import { getWallet } from '../utils/wallet';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const normalizeRole = (role) => (role || localStorage.getItem('user_role') || 'STAFF').toUpperCase();
const fallbackClinicName = () => localStorage.getItem('clinic_name') || localStorage.getItem('user_clinic_name') || 'Clinic Workspace';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const userIndustry = localStorage.getItem('user_industry') || 'general';
  const wallet = getWallet();
  const [lifetimeCount, setLifetimeCount] = useState(0);
  const [quickRechargeOpen, setQuickRechargeOpen] = useState(false);
  const [quickRechargeLoading, setQuickRechargeLoading] = useState(false);
  const [profile, setProfile] = useState({
    role: normalizeRole(),
    name: localStorage.getItem('user_name') || 'Team Member',
    clinicName: fallbackClinicName(),
  });
  const backendPath = (path) => String(api.defaults?.baseURL || '').replace(/\/+$/, '').endsWith('/api') ? path.replace(/^\/api/, '') : path;

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const meta = data?.user?.user_metadata || {};
      const userId = data?.user?.id || localStorage.getItem('user_id');
      const role = normalizeRole(meta.role || meta.user_role || meta.account_role);
      const name = meta.staff_name || meta.full_name || meta.name || data?.user?.email || profile.name;
      const clinicName = meta.clinic_name || meta.business_name || meta.businessName || fallbackClinicName();
      if (active) setProfile({ role, name, clinicName });
      if (userId) {
        const usageResult = await api
          .get(backendPath('/api/user/usage'), { params: { userId } })
          .catch(() => ({ data: null }));
        if (active && usageResult.data) {
          setLifetimeCount(Number(usageResult.data.lifetime_patients_count || 0));
        }
      }
    };
    loadProfile();
    return () => { active = false; };
  }, []);

  const isStaff = profile.role === 'STAFF';
  const isWalletLow = Number(wallet.balance || 0) < 20;
  const isActive = (path) => {
    if (path === '/templates') return location.pathname === '/templates' || location.pathname === '/templates/create';
    return location.pathname === path;
  };

  const menuClass = (path) => `
    flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium mb-1
    ${isActive(path)
      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 font-bold'
      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'}
  `;

  const mainLinks = [
    { name: 'Dashboard', path: isStaff ? '/staff/dashboard' : '/dashboard', icon: LayoutDashboard },
    { name: 'Campaigns', path: '/campaigns', icon: Send },
    !isStaff && { name: 'WA Template', path: '/templates', icon: LayoutTemplate },
    { name: 'Inbox', path: '/dashboard/inbox', icon: MessageSquare },
    { name: 'Patients', path: '/dashboard/contacts', icon: Users },
    !isStaff && { name: 'Yogi Wallet', path: '/dashboard/wallet', icon: Wallet },
    !isStaff && { name: 'AI Settings', path: '/dashboard/ai-settings', icon: Bot },
    { name: 'Ads CRM', path: '/dashboard/ads-crm', icon: Megaphone },
    {
      name: 'Team Setup',
      path: '/team',
      icon: Users
    },
  ].filter(Boolean);

  const openPayuRecharge = async (amount) => {
    if (quickRechargeLoading) return;
    try {
      setQuickRechargeLoading(true);
      const { data } = await supabase.auth.getUser();
      const userId = data?.user?.id || localStorage.getItem('user_id');
      const email = data?.user?.email || localStorage.getItem('user_email') || '';
      const phone = data?.user?.user_metadata?.phone || localStorage.getItem('user_phone') || '';

      if (!userId || !email) throw new Error('Please login again before recharging.');

      const response = await api.post('/payments/initiate-payu', {
        userId,
        amount,
        firstname: profile.name || 'Yogi Desk User',
        email,
        phone,
      });

      const payuPayload = response.data?.payload;
      if (!response.data?.success || !payuPayload?.hash) throw new Error(response.data?.msg || 'Unable to open checkout.');

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = response.data.checkoutUrl;
      form.target = '_self';
      form.style.display = 'none';

      Object.entries(payuPayload).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        const field = document.createElement('input');
        field.type = 'hidden';
        field.name = key;
        field.value = String(value);
        form.appendChild(field);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      alert(error.message || 'Unable to start quick recharge.');
      setQuickRechargeLoading(false);
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 z-40 flex-shrink-0 font-sans">
      <div className="p-6 flex items-center gap-3 flex-shrink-0 border-b border-gray-50">
        <Link to={isStaff ? '/staff/dashboard' : '/dashboard'} className="flex h-14 md:h-16 lg:h-20 items-center shrink-0" aria-label="Yogi Desk AI dashboard">
          <img
            src="/assets/yogidesk-logo.png"
            alt="Yogi Desk AI"
            className="h-14 md:h-16 lg:h-20 w-auto object-contain"
          />
        </Link>
        <div className="min-w-0">
          <span className="block truncate text-[11px] font-bold tracking-wider text-gray-400">{profile.clinicName}</span>
        </div>
      </div>

      {!isStaff && (
        <div className="px-4 py-6">
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4 rounded-2xl">
            <div className="flex items-center gap-2 text-orange-600 mb-2">
              <Wallet size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Yogi Wallet</span>
            </div>
            <p className="text-2xl font-black text-slate-900">Rs. {wallet.balance.toFixed(2)}</p>
            <div className="mt-3 rounded-xl border border-orange-100 bg-white/70 px-3 py-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>Patients</span>
                <span className="text-slate-900">{lifetimeCount}/500</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-orange-100">
                <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(100, (lifetimeCount / 500) * 100)}%` }} />
              </div>
            </div>
            <Link to="/dashboard/wallet" className="mt-3 flex items-center justify-between text-[11px] text-orange-700 font-bold hover:gap-3 transition-all">
              Recharge Credits
              <span aria-hidden="true">&gt;</span>
            </Link>
            {isWalletLow && (
              <div className="mt-3 rounded-xl border border-orange-200 bg-white p-3">
                <button
                  type="button"
                  onClick={() => setQuickRechargeOpen((open) => !open)}
                  className="flex w-full items-center justify-between text-left text-[11px] font-black uppercase tracking-widest text-orange-700"
                >
                  Quick Recharge
                  <ChevronDown size={14} className={`transition ${quickRechargeOpen ? 'rotate-180' : ''}`} />
                </button>
                {quickRechargeOpen && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[200, 500].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        disabled={quickRechargeLoading}
                        onClick={() => openPayuRecharge(amount)}
                        className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-700 disabled:opacity-60"
                      >
                        Rs. {amount}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Main Menu</p>
        {mainLinks.map(({ name, path, icon }) => (
          <Link key={path} to={path} className={menuClass(path)}>{React.createElement(icon, { size: 20 })}<span>{name}</span></Link>
        ))}

        {userIndustry === 'hospital' && (
          <>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-6 mb-2 px-2">Healthcare</p>
            <Link to="/hospital/discharge" className={menuClass('/hospital/discharge')}>
              <HeartPulse size={20} /><span>Patient Feedback</span>
            </Link>
          </>
        )}

      </nav>

      <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50 mt-auto">
        <Link to="/dashboard/support" className={menuClass('/dashboard/support')}><LifeBuoy size={20} /><span>Support</span></Link>
        <Link to="/dashboard/settings" className={menuClass('/dashboard/settings')}><Settings size={20} /><span>Settings</span></Link>
        <button
          onClick={async () => { await logout(); navigate('/login'); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium mt-2"
        >
          <LogOut size={20} /><span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
