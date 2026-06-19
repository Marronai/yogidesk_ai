import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { blockLiveSupportWidgetsForMetaReview } from '../utils/metaReviewSession';

const TAWK_SCRIPT_ID = 'yogidesk-tawk-widget';
const TAWK_EMBED_URL = 'https://embed.tawk.to/6a2bfd7374b4d41c29150020/1jqttc32p';

const removeTawkWidget = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  document
    .querySelectorAll(`#${TAWK_SCRIPT_ID},script[src*="embed.tawk.to"],iframe[src*="tawk.to"],iframe[title*="chat"],iframe[title*="Chat"]`)
    .forEach((node) => node.remove());

  try {
    window.Tawk_API?.hideWidget?.();
    window.Tawk_API?.shutdown?.();
  } catch {
    // Tawk cleanup must never affect dashboard routing.
  }

  try {
    delete window.Tawk_API;
    delete window.Tawk_LoadStart;
  } catch {
    window.Tawk_API = undefined;
    window.Tawk_LoadStart = undefined;
  }
};

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isMetaReviewSession, user, userProfile } = useAuth();
  const [isWelcomeActive, setIsWelcomeActive] = useState(false);
  const [isWelcomeRevealing, setIsWelcomeRevealing] = useState(false);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [trialAlert, setTrialAlert] = useState(null);
  const [lowBalanceAlert, setLowBalanceAlert] = useState(null);
  const [lowBalanceDismissed, setLowBalanceDismissed] = useState(false);

  useEffect(() => {
    setIsWelcomeActive(false);
    setIsWelcomeRevealing(false);
    return undefined;
  }, [isAuthenticated, isMetaReviewSession, user?.id]);

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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    if (!isAuthenticated || !user?.id || isMetaReviewSession) {
      removeTawkWidget();
      return undefined;
    }

    const clinicName = (
      userProfile?.clinic_name ||
      userProfile?.business_name ||
      userProfile?.clinicName ||
      user?.user_metadata?.clinic_name ||
      user?.user_metadata?.businessName ||
      user?.user_metadata?.name ||
      localStorage.getItem('clinic_name') ||
      localStorage.getItem('user_name') ||
      'YogiDesk Doctor'
    );
    const clinicPhone = (
      userProfile?.clinic_phone ||
      userProfile?.phone ||
      userProfile?.mobile ||
      userProfile?.whatsapp_number ||
      userProfile?.whatsapp_phone ||
      user?.user_metadata?.phone ||
      localStorage.getItem('user_phone') ||
      ''
    );

    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = window.Tawk_LoadStart || new Date();
    window.Tawk_API.customStyle = {
      visibility: {
        desktop: {
          position: 'br',
          xOffset: 24,
          yOffset: 24,
        },
        mobile: {
          position: 'br',
          xOffset: 16,
          yOffset: 84,
        },
      },
    };
    window.Tawk_API.onLoad = function onTawkLoad() {
      try {
        window.Tawk_API?.setAttributes?.({
          name: clinicName || 'YogiDesk Doctor',
          phone: clinicPhone || '',
        }, function noop() {});
      } catch (error) {
        console.warn('Tawk visitor prefill skipped:', error?.message || error);
      }
    };

    if (!document.getElementById(TAWK_SCRIPT_ID)) {
      const script = document.createElement('script');
      const firstScript = document.getElementsByTagName('script')[0];
      script.id = TAWK_SCRIPT_ID;
      script.async = true;
      script.src = TAWK_EMBED_URL;
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');
      if (firstScript?.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      } else {
        document.head.appendChild(script);
      }
    } else {
      window.Tawk_API.onLoad();
      window.Tawk_API?.showWidget?.();
    }

    return () => {
      removeTawkWidget();
    };
  }, [isAuthenticated, isMetaReviewSession, user?.id, user?.user_metadata, userProfile]);

  useEffect(() => {
    setLowBalanceDismissed(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    const loadAiBalance = async () => {
      try {
        const response = await api.get('/ai/settings');
        if (!active) return;
        const settings = response.data?.settings || {};
        const balance = Number(settings.message_credit_balance ?? settings.aiMessageBalance ?? settings.tokenLimit ?? 0);
        if (Number.isFinite(balance) && balance <= 50) {
          setLowBalanceAlert({ balance });
        } else {
          setLowBalanceAlert(null);
        }
      } catch (error) {
        console.warn('AI balance monitor unavailable:', error?.message || error);
      }
    };

    loadAiBalance();
    const intervalId = window.setInterval(loadAiBalance, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 font-sans md:flex-row">
      {isWelcomeActive && (
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-neutral-950 transition-all duration-700 ease-in-out ${
            isWelcomeRevealing ? '-translate-y-8 scale-105 opacity-0' : 'translate-y-0 scale-100 opacity-100'
          }`}
          role="status"
          aria-live="polite"
          aria-label="Opening YogiDesk workspace"
        >
          <style>
            {`
              @keyframes yogideskBrandSlide {
                0%, 35% { width: 4rem; gap: 0; }
                55%, 100% { width: 18rem; gap: 1rem; }
              }
              @keyframes yogideskWordReveal {
                0%, 42% { opacity: 0; transform: translateX(-18px); }
                62%, 100% { opacity: 1; transform: translateX(0); }
              }
              @keyframes yogideskSubcopyReveal {
                0%, 55% { opacity: 0; transform: translateY(14px); letter-spacing: 0.34em; }
                78%, 100% { opacity: 1; transform: translateY(0); letter-spacing: 0.02em; }
              }
              @keyframes yogideskAmbientSweep {
                0% { transform: translateX(-45%) rotate(18deg); opacity: 0; }
                45% { opacity: 0.45; }
                100% { transform: translateX(45%) rotate(18deg); opacity: 0; }
              }
            `}
          </style>
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/20 blur-3xl" />
            <div
              className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-sm"
              style={{ animation: 'yogideskAmbientSweep 3.4s ease-in-out both' }}
            />
          </div>
          <div
            className="relative flex h-20 items-center justify-center overflow-hidden"
            style={{ animation: 'yogideskBrandSlide 3s ease-in-out both' }}
          >
            <div className="flex h-16 w-16 shrink-0 animate-pulse items-center justify-center rounded-2xl bg-orange-500 text-2xl font-black text-white shadow-lg shadow-orange-500/30">
              YD
            </div>
            <div
              className="whitespace-nowrap text-5xl font-black tracking-tight text-white"
              style={{ animation: 'yogideskWordReveal 3s ease-out both' }}
            >
              Yogi<span className="text-orange-500">Desk</span>
            </div>
          </div>
          <p
            className="relative mt-8 text-center text-xs font-bold uppercase text-white/70 sm:text-sm"
            style={{ animation: 'yogideskSubcopyReveal 3.4s ease-out both' }}
          >
            Advanced AI Assistant for Healthcare Workspaces
          </p>
        </div>
      )}
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

      {lowBalanceAlert && !lowBalanceDismissed && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-t-[2rem] border border-orange-100 bg-white shadow-2xl sm:rounded-[2rem]">
            <div className="bg-[#501638] px-6 py-5 text-white sm:px-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-100">AI Receptionist Fuel Alert</p>
              <h2 className="mt-2 text-2xl font-black leading-tight sm:text-3xl">Respected Doctor, Your Virtual Clinic Receptionist Needs a Quick Recharge! ⚠️</h2>
            </div>
            <div className="space-y-4 bg-white px-6 py-5 sm:px-8">
              <div className="rounded-2xl border border-orange-100 bg-[#fffaf3] p-4 text-sm font-semibold leading-6 text-slate-800">
                While you are busy saving lives and conducting operations, your YogiDesk AI Receptionist is working 24/7 without a single break. Right now, it is instantly answering patient queries, sharing prescription details, and automatically booking slots so that your clinic never loses a single patient to competitors.
              </div>
              <div className="rounded-2xl border border-orange-100 bg-white p-4 text-sm font-semibold leading-6 text-slate-800 shadow-sm">
                Currently, your active fuel balance has dropped below 50 messages. If it hits 0, the automated receptionist will have to shut down, meaning emergency consultation bookings might be missed, and patients will face long delays waiting for manual responses.
              </div>
              <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">
                Active AI balance: {Number(lowBalanceAlert.balance || 0).toLocaleString('en-IN')} credits
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/ai-recharge#ai-checkout')}
                  className="inline-flex w-full animate-pulse items-center justify-center rounded-2xl bg-[#FF6B00] px-5 py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600"
                >
                  KEEP MY AI ASSISTANT ALIVE (RECHARGE NOW)
                </button>
                <button
                  type="button"
                  onClick={() => setLowBalanceDismissed(true)}
                  className="rounded-2xl border border-slate-200 px-5 py-4 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
