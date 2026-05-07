import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import axios from 'axios';

const MainLayout = () => {
  const navigate = useNavigate();

  // 🔥 AUTO LOGOUT LOGIC (Session Polling)
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'https://yogidesk-ai.com/api';

    const checkSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        await axios.get(`${API_URL}/auth/check-session`, {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true
        });
        // Agar success hai to kuch mat karo, sab sahi hai
      } catch (error) {
        if (error.response?.status === 401) {
          console.log("Session expired or invalid");
          localStorage.clear();
          alert("You have been logged out because you logged in on another device.");
          window.location.href = '/login';
        } else {
          console.warn('Session check failed but not logging out:', error.message || error);
        }
      }
    };

    const intervalId = setInterval(checkSession, 3000); // 3 Seconds interval

    return () => clearInterval(intervalId); // Cleanup
  }, [navigate]);

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <div className="lg:flex hidden flex-shrink-0">
        <Sidebar />
      </div>

      <div className="w-full lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">V</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Vyapar Wallah</p>
              <p className="text-xs text-slate-500">Dashboard</p>
            </div>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="px-4 py-2 bg-slate-100 rounded-2xl text-slate-700 font-semibold">
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-gray-200 p-4 bg-white">
            <Sidebar />
          </div>
        )}
      </div>

      <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;