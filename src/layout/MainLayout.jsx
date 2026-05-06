import React, { useEffect } from 'react';
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

  return (
    // 🔥 SCROLL FIX: 'h-screen' aur 'overflow-hidden' parent par
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      
      {/* Sidebar (Fixed width) */}
      <div className="flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main Content (Ye area scroll karega) */}
      <main className="flex-1 h-full overflow-y-auto p-8 transition-all duration-300">
        {/* 'mt-0' ensure karega ki upar gap na ho */}
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

    </div>
  );
};

export default MainLayout;