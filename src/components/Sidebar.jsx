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
} from 'lucide-react';
import { getWallet } from '../utils/wallet';
import { supabase } from '../config/supabaseClient';

const normalizeRole = (role) => (role || localStorage.getItem('user_role') || 'STAFF').toUpperCase();
const fallbackClinicName = () => localStorage.getItem('clinic_name') || localStorage.getItem('user_clinic_name') || 'Clinic Workspace';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const userIndustry = localStorage.getItem('user_industry') || 'general';
  const wallet = getWallet();
  const [profile, setProfile] = useState({
    role: normalizeRole(),
    name: localStorage.getItem('user_name') || 'Team Member',
    clinicName: fallbackClinicName(),
  });

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const meta = data?.user?.user_metadata || {};
      const role = normalizeRole(meta.role || meta.user_role || meta.account_role);
      const name = meta.staff_name || meta.full_name || meta.name || data?.user?.email || profile.name;
      const clinicName = meta.clinic_name || meta.business_name || meta.businessName || fallbackClinicName();
      if (active) setProfile({ role, name, clinicName });
    };
    loadProfile();
    return () => { active = false; };
  }, []);

  const isStaff = profile.role === 'STAFF';
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
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Campaigns', path: '/campaigns', icon: Send },
    !isStaff && { name: 'WA Template', path: '/templates', icon: LayoutTemplate },
    { name: 'Inbox', path: '/dashboard/inbox', icon: MessageSquare },
    { name: 'Patients', path: '/dashboard/contacts', icon: Users },
    !isStaff && { name: 'Yogi Wallet', path: '/dashboard/wallet', icon: Wallet },
    { name: 'Ads CRM', path: '/dashboard/ads-crm', icon: Megaphone },
    {
      name: 'Team Setup',
      path: '/team',
      icon: Users
    },
  ].filter(Boolean);

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 z-40 flex-shrink-0 font-sans">
      <div className="p-6 flex items-center gap-3 flex-shrink-0 border-b border-gray-50">
        <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-orange-500/20">Y</div>
        <div className="min-w-0">
          <span className="block text-xl font-bold text-gray-800 tracking-wide">Yogi Desk</span>
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
            <Link to="/dashboard/wallet" className="mt-3 flex items-center justify-between text-[11px] text-orange-700 font-bold hover:gap-3 transition-all">
              Recharge Credits
              <span aria-hidden="true">&gt;</span>
            </Link>
          </div>
        </div>
      )}

      <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Main Menu</p>
        {mainLinks.map(({ name, path, icon: Icon }) => (
          <Link key={path} to={path} className={menuClass(path)}><Icon size={20} /><span>{name}</span></Link>
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
          onClick={() => { localStorage.clear(); navigate('/login'); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium mt-2"
        >
          <LogOut size={20} /><span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
