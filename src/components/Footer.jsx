import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Facebook, Gauge, Instagram, Linkedin, Twitter, X } from 'lucide-react';

const systemMetrics = [
  { name: 'Meta Cloud API Engine', status: 'Operational', latency: '42ms' },
  { name: 'WhatsApp Webhook Listener', status: 'Operational', latency: '18ms' },
  { name: 'Database Clusters (Supabase)', status: 'Operational', latency: '25ms' },
  { name: 'Email Relay Node (Brevo)', status: 'Operational', latency: '110ms' },
];

const Footer = () => {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  useEffect(() => {
    if (!isStatusModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsStatusModalOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStatusModalOpen]);

  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-900 text-white pt-20 pb-12 md:mt-20 md:pt-24 md:pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid gap-y-12 gap-x-8 md:grid-cols-4 md:gap-x-12">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center text-white font-bold text-xl">Y</div>
              <span className="text-xl font-bold">Yogi Desk AI</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              The complete WhatsApp automation platform for clinics, doctors, hospitals, and healthcare teams.
            </p>
            <div className="flex gap-4 mt-6">
              <a href="#" className="text-slate-400 hover:text-[#FF6B00] transition"><Facebook size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-[#FF6B00] transition"><Twitter size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-[#FF6B00] transition"><Instagram size={20} /></a>
              <a href="#" className="text-slate-400 hover:text-[#FF6B00] transition"><Linkedin size={20} /></a>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Product</h3>
            <ul className="space-y-2 text-slate-400">
              <li><Link to="/features" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Features</Link></li>
              <li><Link to="/pricing" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Pricing</Link></li>
              <li><Link to="/integrations" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Integrations</Link></li>
              <li><Link to="/api-docs" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">API Docs</Link></li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Support</h3>
            <ul className="space-y-2 text-slate-400">
              <li><Link to="/help" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Help Center</Link></li>
              <li><Link to="/contact" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Contact Us</Link></li>
              <li>
                <a
                  href="/status"
                  onClick={(event) => {
                    event.preventDefault();
                    setIsStatusModalOpen(true);
                  }}
                  className="cursor-pointer hover:text-[#FF6B00] transition"
                >
                  System Status
                </a>
              </li>
              <li><Link to="/community" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Community</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-bold text-lg mb-4">Legal</h3>
            <ul className="space-y-2 text-slate-400">
              <li><Link to="/privacy-policy" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Privacy Policy</Link></li>
              <li><Link to="/terms-and-conditions" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Terms & Conditions</Link></li>
              <li><Link to="/terms" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Terms of Service</Link></li>
              <li><Link to="/cookies" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">Cookie Policy</Link></li>
              <li><Link to="/gdpr" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">GDPR</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-slate-800 mt-14 pt-8 text-center">
          <p className="text-slate-400 text-sm">© 2026 Yogi Desk AI. All rights reserved.</p>
          <p className="mt-2 text-xs font-medium tracking-wide text-slate-500">A product of Vyapar Wallah</p>
        </div>
      </div>

      {isStatusModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-status-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsStatusModalOpen(false);
          }}
        >
          <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[1.75rem] border border-white/10 bg-[#0B0F19] text-[#FFFFFF] shadow-2xl sm:rounded-[1.75rem]">
            <div className="relative border-b border-white/10 px-5 pb-6 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-9">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="absolute right-4 top-4 flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-[#10B981]/50 hover:bg-[#10B981]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981] sm:right-5 sm:top-5"
                aria-label="Close system status dialog"
              >
                <X size={21} />
              </button>

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10B981]/15 text-[#10B981] ring-1 ring-[#10B981]/30">
                <Activity size={25} />
              </div>
              <h2 id="system-status-title" className="mx-auto mt-4 max-w-md px-8 text-xl font-black leading-tight sm:text-2xl">
                YogiDesk AI - Global System Status
              </h2>
              <div className="mx-auto mt-5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-2 text-xs font-black text-[#10B981] shadow-[0_0_24px_rgba(16,185,129,0.16)] sm:text-sm">
                <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#10B981] shadow-[0_0_12px_#10B981]" />
                <span>All Systems Operational (99.98% Uptime)</span>
              </div>
            </div>

            <div className="space-y-3 px-4 py-5 sm:px-8 sm:py-7">
              {systemMetrics.map((metric) => (
                <div
                  key={metric.name}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 transition hover:border-[#10B981]/30 hover:bg-white/[0.06] sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-5 text-white sm:text-base">{metric.name}</p>
                    <p className="mt-1 text-xs font-semibold text-[#10B981]">{metric.status}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-xl bg-black/25 px-3 py-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                    </span>
                    <Gauge size={14} className="hidden text-slate-400 sm:block" />
                    <span className="text-xs font-black tabular-nums text-white sm:text-sm">{metric.latency}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 px-4 py-4 sm:px-8 sm:py-5">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[#10B981] px-5 py-3 text-sm font-black text-[#0B0F19] transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30 active:scale-[0.99]"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
