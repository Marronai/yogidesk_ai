import React, { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { blockLiveSupportWidgetsForMetaReview } from '../utils/metaReviewSession';

const MainLayout = () => {
  const navigate = useNavigate();
  const { isMetaReviewSession } = useAuth();

  // 🔥 AUTO LOGOUT LOGIC (Session Polling)
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      if (token.startsWith('supabase-bypass-token-')) return;

      try {
        await api.get('/auth/check-session');
        // Agar success hai to kuch mat karo, sab sahi hai
      } catch (error) {
        const status = Number(error.response?.status);
        if (status === 401 || status === 403) {
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [trialAlert, setTrialAlert] = useState(null);

  useEffect(() => {
    let active = true;

    const loadTrialState = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id || localStorage.getItem('user_id');
        if (!userId) return;

        const response = await api.get('/profile/trial', { params: { userId } });
        if (!active) return;

        if (response.data?.shouldShowRetentionModal) {
          setTrialAlert({
            remainingHours: response.data.remainingHours,
            profile: response.data.profile,
          });
        }
      } catch (error) {
        console.warn('Trial retention state unavailable:', error?.message || error);
      }
    };

    loadTrialState();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isMetaReviewSession) blockLiveSupportWidgetsForMetaReview();
  }, [isMetaReviewSession]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans md:flex-row">
      <div className="hidden flex-shrink-0 md:block">
        <Sidebar />
      </div>

      <div className="block w-full border-b border-gray-200 bg-white md:hidden sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white" aria-label="Yogidesk.ai dashboard">
              <img
                src="/logo.png"
                alt="YogiDesk AI Logo"
                className="h-8 w-auto object-contain"
              />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-tight text-slate-950">Yogidesk.ai</p>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Dashboard</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/40"
            aria-label="Close navigation menu"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 transform bg-[#FFFFFF] shadow-xl transition-transform duration-300 translate-x-0">
            <Sidebar />
          </div>
        </div>
      )}

      <main className="h-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 transition-all duration-300 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      {trialAlert && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-lg rounded-t-[2rem] border border-orange-100 bg-white p-6 shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-600">Premium Trial</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Your Premium Access is about to expire!</h2>
              </div>
              <button
                type="button"
                onClick={() => setTrialAlert(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"
              >
                Later
              </button>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
              Upgrade today to protect your active patient analytics and automation slots.
            </p>
            <p className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
              {trialAlert.remainingHours || 48} hours remaining in your Growth trial.
            </p>
            <button
              type="button"
              onClick={() => { window.location.href = '/pricing'; }}
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[#FF6A00] px-5 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
