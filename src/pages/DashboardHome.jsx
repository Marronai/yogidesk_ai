import React, { useEffect, useState } from 'react';
import { 
  Send, CheckCircle, MessageSquare, Users, 
  Zap, TrendingUp, Facebook, Globe, ArrowUpRight,
  PieChart, Shield, AlertCircle, PlayCircle, PauseCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DashboardHome = () => {
  const userName = localStorage.getItem('user_name') || 'Dr. Avinash';
  const category = localStorage.getItem('org_category') || 'hospital';

  // Mock Data (Real world scenario)
  const stats = {
    weekly_sent: 8500,
    weekly_limit: 10000,
    leads_today: 12,
    ghost_mode: true
  };

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      
      {/* 1. HEADER & GHOST MODE STATUS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Namaste, {userName} 🙏</h1>
          <p className="text-gray-500 mt-1">Here is your clinic's weekly performance.</p>
        </div>
        
        <div className="flex items-center gap-4">
            {/* Ghost Mode Indicator */}
            <div className={`px-4 py-2 rounded-full border flex items-center gap-2 ${stats.ghost_mode ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 text-gray-500'}`}>
                <Shield size={18} className={stats.ghost_mode ? 'fill-purple-700' : ''}/> 
                <span className="text-sm font-bold">{stats.ghost_mode ? 'Ghost Mode Active' : 'Ghost Mode Off'}</span>
            </div>

            <Link to="/campaigns" className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand/20 transition transform hover:-translate-y-0.5">
                <Zap size={20} /> New Broadcast
            </Link>
        </div>
      </div>

      {/* 2. VITAL STATS ROW (Limit & Volume) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         
         {/* Card 1: Weekly Volume */}
         <div className="white-card p-6 flex items-center justify-between">
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">Messages Sent (This Week)</p>
                <h3 className="text-3xl font-extrabold text-gray-900">{stats.weekly_sent.toLocaleString()}</h3>
                <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded flex w-fit mt-2">
                    <TrendingUp size={12} className="mr-1"/> +15% Growth
                </span>
            </div>
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
                <Send size={28}/>
            </div>
         </div>

         {/* Card 2: Daily Limit (Progress Bar Visual) */}
         <div className="white-card p-6 flex flex-col justify-center">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <p className="text-gray-500 text-sm font-medium">Message Limit Used</p>
                    <h3 className="text-2xl font-extrabold text-gray-900">85% <span className="text-sm text-gray-400 font-normal">/ 10k Limit</span></h3>
                </div>
                <div className="p-2 bg-orange-50 text-brand rounded-xl">
                    <Zap size={20}/>
                </div>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full" style={{width: '85%'}}></div>
            </div>
            <p className="text-xs text-red-500 mt-2 font-medium">⚠️ You are reaching your daily limit.</p>
         </div>

         {/* Card 3: Leads from Ads */}
         <div className="white-card p-6 flex items-center justify-between border-l-4 border-l-green-500">
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">New Patients from Ads</p>
                <h3 className="text-3xl font-extrabold text-gray-900">{stats.leads_today}</h3>
                <p className="text-xs text-gray-400 mt-1">Since today morning</p>
            </div>
            <div className="p-4 bg-green-50 text-green-600 rounded-2xl">
                <Users size={28}/>
            </div>
         </div>
      </div>

      {/* 3. VISUAL INSIGHTS ROW (Pie Chart & Ads) */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left: Template Health (Visual Pie Chart) */}
        <div className="white-card p-6 flex flex-col">
            <h3 className="font-bold text-gray-800 text-lg mb-6 flex items-center gap-2">
                <PieChart size={20} className="text-gray-400"/> WhatsApp Template Status
            </h3>
            
            <div className="flex items-center gap-8">
                {/* CSS Pie Chart (No Library Needed) */}
                <div className="relative w-32 h-32 rounded-full" 
                     style={{
                        background: 'conic-gradient(#22c55e 0% 70%, #ef4444 70% 85%, #eab308 85% 100%)'
                     }}>
                     <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-800">12</span>
                     </div>
                </div>
                
                {/* Legend */}
                <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        <span className="text-gray-600">Approved (8)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                        <span className="text-gray-600">Rejected (2)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                        <span className="text-gray-600">Pending (2)</span>
                    </div>
                </div>
            </div>
            <div className="mt-6 bg-gray-50 p-3 rounded-lg text-xs text-gray-500">
                Tip: Avoid using promotional words like "Discount" to get fast approval.
            </div>
        </div>

        {/* Center: Live Ads Manager (Visual List) */}
        <div className="lg:col-span-2 white-card p-0 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <Facebook size={20} className="text-blue-600"/> Live Ad Campaigns
                </h3>
                <span className="text-xs bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full animate-pulse">
                    ● Live Now
                </span>
            </div>

            <div className="p-6 grid gap-4">
                {/* Ad Card 1 */}
                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-md transition bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">IMG</div>
                        <div>
                            <h4 className="font-bold text-gray-800">Dental Checkup Promo</h4>
                            <p className="text-xs text-gray-500">Facebook Feed • Started 2 days ago</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">124</div>
                        <p className="text-xs text-gray-500">Clicks Today</p>
                    </div>
                    <button className="text-red-500 hover:bg-red-50 p-2 rounded-full"><PauseCircle size={20}/></button>
                </div>

                {/* Ad Card 2 */}
                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:shadow-md transition bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center font-bold text-xs">VID</div>
                        <div>
                            <h4 className="font-bold text-gray-800">Free Eye Test Camp</h4>
                            <p className="text-xs text-gray-500">Instagram Reels • Started Today</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-gray-900">85</div>
                        <p className="text-xs text-gray-500">Clicks Today</p>
                    </div>
                    <button className="text-green-500 hover:bg-green-50 p-2 rounded-full"><PlayCircle size={20}/></button>
                </div>
            </div>
        </div>

      </div>

      {/* 4. WEEKLY GRAPH (Simple CSS Bars) */}
      <div className="white-card p-6">
        <h3 className="font-bold text-gray-800 text-lg mb-6">Message Sent History (Last 7 Days)</h3>
        <div className="h-48 flex items-end justify-between gap-4 px-4">
            {[45, 70, 30, 85, 55, 95, 40].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                <div className="w-full bg-gray-100 rounded-t-lg relative h-full flex items-end overflow-hidden group-hover:bg-gray-200 transition">
                    <div 
                        className="w-full bg-brand rounded-t-lg transition-all duration-700 ease-out group-hover:bg-brand-dark" 
                        style={{ height: `${h}%` }}
                    ></div>
                </div>
                <span className="text-xs text-gray-400 font-bold">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
              </div>
            ))}
        </div>
      </div>

    </div>
  );
};

export default DashboardHome;