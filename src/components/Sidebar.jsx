import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  UserPlus, 
  Settings,
  Megaphone, 
  LifeBuoy, 
  LogOut,
  Crown,
  Clock,
  ChevronRight,
  Send,
  HeartPulse,
  GraduationCap,
  Rocket,
  FileText,
  ShieldCheck
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // 🛠️ DATA RECOVERY
  const userPlan = localStorage.getItem('user_plan_type') || 'lite';
  const userRole = localStorage.getItem('user_role') || 'employee';
  const userIndustry = localStorage.getItem('user_industry') || 'general';
  const subscriptionStatus = localStorage.getItem('user_subscription_status') || 'trial';
  const expiryDate = localStorage.getItem('user_plan_expiry');

  const calculateDaysLeft = (date) => {
    if (!date) return 0;
    const diff = new Date(date) - new Date();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const daysLeft = calculateDaysLeft(expiryDate);
  const isPremium = subscriptionStatus === 'active';

  const isActive = (path) => {
    if (path === '/templates') {
      return location.pathname === '/templates' || location.pathname === '/templates/create';
    }
    return location.pathname === path;
  };

  // Helper for Link styling
  const menuClass = (path) => `
    flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium mb-1
    ${isActive(path)
      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 font-bold'
      : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'}
  `;

  return (
    <>
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 z-40 flex-shrink-0 font-sans">
        
        {/* Logo Section */}
        <div className="p-6 flex items-center gap-3 flex-shrink-0 border-b border-gray-50">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-orange-500/20 text-center leading-10">V</div>
          <span className="text-xl font-bold text-gray-800 tracking-wide">Vyapar Wallah</span>
        </div>

        {/* 🚀 SUBSCRIPTION STATUS BADGE */}
        <div className="px-4 py-6">
          {isPremium ? (
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 rounded-2xl text-white shadow-xl relative overflow-hidden group">
              <div className="absolute -right-2 -top-2 opacity-10 group-hover:scale-110 transition-transform"><Crown size={60} /></div>
              <div className="flex items-center gap-2 mb-1">
                <Crown size={14} className="text-yellow-400 fill-yellow-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400">Premium Plan</span>
              </div>
              <p className="text-xs font-bold">All Features Unlocked</p>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-orange-600">
                  <Clock size={14} /><span className="text-[10px] font-black uppercase tracking-widest text-center">Free Trial</span>
                </div>
                <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{daysLeft}d left</span>
              </div>
              <Link to="/pricing" className="flex items-center justify-between text-[11px] text-orange-700 font-bold hover:gap-3 transition-all">Upgrade to Premium <ChevronRight size={14} /></Link>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 py-2 overflow-y-auto custom-scrollbar">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Main Menu</p>
          
          {/* ✅ UPDATED LINKS: Added '/dashboard' prefix where needed */}
          <Link to="/dashboard" className={menuClass('/dashboard')}><LayoutDashboard size={20} /><span>Dashboard</span></Link>
          
          {/* Note: Campaigns is a standalone tool, so keep it '/campaigns' or move inside dashboard if needed */}
          <Link to="/campaigns" className={menuClass('/campaigns')}><Send size={20} /><span>Campaigns</span></Link> 
          
          <Link to="/dashboard/inbox" className={menuClass('/dashboard/inbox')}><MessageSquare size={20} /><span>Inbox</span></Link>
          <Link to="/dashboard/contacts" className={menuClass('/dashboard/contacts')}><Users size={20} /><span>Contacts</span></Link>
          <Link to="/dashboard/subscription" className={menuClass('/dashboard/subscription')}><Crown size={20} /><span>Subscription</span></Link>

          {/* 🏥 HOSPITAL MODULE */}
          {userIndustry === 'hospital' && (
            <>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-6 mb-2 px-2">Healthcare</p>
              <Link to="/hospital/discharge" className={menuClass('/hospital/discharge')}>
                <HeartPulse size={20} /><span>Patient Feedback</span>
              </Link>
            </>
          )}

          {/* 🎓 EDUCATION MODULE */}
          {userIndustry === 'education' && (
            <>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-6 mb-2 px-2">Institution</p>
              <Link to="/edu/fees" className={menuClass('/edu/fees')}>
                <GraduationCap size={20} /><span>Fee Reminders</span>
              </Link>
            </>
          )}

          {/* 🚀 STARTUP MODULE */}
          {userIndustry === 'startup' && (
            <>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-6 mb-2 px-2">Growth</p>
              <Link to="/leads/automation" className={menuClass('/leads/automation')}>
                <Rocket size={20} /><span>Lead Follow-up</span>
              </Link>
            </>
          )}

          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-6 mb-2 px-2">Management & Tools</p>

          {userRole === 'admin' && (
            <Link to="/dashboard/admin" className={menuClass('/dashboard/admin')}>
              <ShieldCheck size={20} /><span>Admin Dashboard</span>
            </Link>
          )}
          
          {/* 🔥 TEAM MANAGEMENT */}
          {(userRole === 'admin' || userRole === 'manager') && (
            <>
              <Link to="/team" className={menuClass('/team')}>
                <UserPlus size={20} /><span>Team & Agents</span>
              </Link>
              <Link to="/templates" className={menuClass('/templates')}>
                <FileText size={20} /><span>WA Templates</span>
              </Link>
            </>
          )}
          
          <Link to="/dashboard/ads-crm" className={menuClass('/dashboard/ads-crm')}><Megaphone size={20} /><span>Ads CRM</span></Link>
        </nav>

        {/* BOTTOM SECTION */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50 mt-auto">
          <Link to="/dashboard/support" className={menuClass('/dashboard/support')}><LifeBuoy size={20} /><span>Support</span></Link>
          
          {userRole === 'admin' && (
             <Link to="/dashboard/settings" className={menuClass('/dashboard/settings')}><Settings size={20} /><span>Settings</span></Link>
          )}
          
          <button 
            onClick={() => { localStorage.clear(); navigate('/login'); }} 
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 transition-all font-medium mt-2"
          >
            <LogOut size={20} /><span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
