import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Pricing', to: '/pricing' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
];

const featureLinks = [
  { label: 'WhatsApp Automation', desc: 'Automated patient alerts & logs', to: '/features' },
  { label: 'Staff Setup', desc: 'RBAC roles for clinic teams', to: '/features#staff-setup' },
  { label: 'Patient Directory', desc: 'CSV and Excel data ingestion', to: '/features#patient-directory' },
  { label: 'Growth Analytics', desc: 'Track retention & clinic revenue leakage', to: '/features#ai-balance' },
];

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const { pathname, hash } = useLocation();

  const isActive = (to) => {
    if (to.startsWith('/features')) return pathname === '/features';
    if (to === '/') return pathname === '/' && hash !== '#features';
    return pathname === to;
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    setIsFeaturesOpen(false);
  };

  return (
    <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-24 flex justify-between items-center">
        <Link to="/" className="flex h-14 sm:h-14 md:h-16 lg:h-20 items-center shrink-0" aria-label="Yogi Desk AI home">
          <img
            src="/assets/yogidesk-logo.png"
            alt="Yogi Desk AI"
            className="h-14 sm:h-14 md:h-16 lg:h-20 w-auto object-contain"
          />
        </Link>

        <div className="hidden lg:flex gap-8 text-sm font-bold text-slate-600 items-center">
          <Link
            to="/"
            className={`${isActive('/') ? 'text-[#FF6B00]' : 'hover:text-[#FF6B00]'} transition`}
          >
            Home
          </Link>
          <div
            className="relative"
            onMouseEnter={() => setIsFeaturesOpen(true)}
            onMouseLeave={() => setIsFeaturesOpen(false)}
          >
            <button
              type="button"
              className={`${isActive('/features') ? 'text-[#FF6B00]' : 'hover:text-[#FF6B00]'} flex items-center gap-1 py-9 transition`}
              onClick={() => setIsFeaturesOpen((open) => !open)}
              aria-expanded={isFeaturesOpen}
            >
              Features <ChevronDown size={14} className={`transition ${isFeaturesOpen ? 'rotate-180' : ''}`} />
            </button>
            <div className={`absolute left-0 top-full w-80 rounded-2xl border border-gray-100 bg-white p-2 shadow-2xl shadow-slate-200/70 transition-all duration-200 ${isFeaturesOpen ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'}`}>
              {featureLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="block rounded-xl px-4 py-3 text-left transition hover:bg-orange-50"
                  onClick={() => setIsFeaturesOpen(false)}
                >
                  <span className="block text-sm font-black text-slate-900">{item.label}</span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.desc}</span>
                </Link>
              ))}
            </div>
          </div>
          {navLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`${isActive(item.to) ? 'text-[#FF6B00]' : 'hover:text-[#FF6B00]'} transition`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex gap-4 items-center">
          <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#FF6B00] transition">Log In</Link>
          <Link to="/signup" className="bg-[#FF6B00] hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-orange-200 flex items-center gap-2 transform hover:-translate-y-0.5">
            Get Started <ArrowRight size={16} />
          </Link>
        </div>

        <button
          type="button"
          className="lg:hidden p-2 text-slate-900 hover:text-[#FF6B00]"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-100 px-6 py-4 space-y-3 flex flex-col font-bold text-slate-600 text-sm">
          <Link
            to="/"
            onClick={closeMenu}
            className={`${isActive('/') ? 'text-[#FF6B00]' : 'hover:text-[#FF6B00]'} py-2`}
          >
            Home
          </Link>
          <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-2">
            <Link
              to="/features"
              onClick={closeMenu}
              className={`${isActive('/features') ? 'text-[#FF6B00]' : 'text-slate-700'} block px-2 py-2 font-black`}
            >
              Features
            </Link>
            <div className="space-y-1">
              {featureLinks.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={closeMenu}
                  className="block rounded-xl bg-white px-3 py-2 shadow-sm"
                >
                  <span className="block text-xs font-black text-slate-900">{item.label}</span>
                  <span className="block text-[11px] font-semibold leading-4 text-slate-500">{item.desc}</span>
                </Link>
              ))}
            </div>
          </div>
          {navLinks.filter((item) => item.to !== '/').map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={closeMenu}
              className={`${isActive(item.to) ? 'text-[#FF6B00]' : 'hover:text-[#FF6B00]'} py-2`}
            >
              {item.label}
            </Link>
          ))}
          <hr className="border-gray-100" />
          <Link to="/login" onClick={closeMenu} className="hover:text-[#FF6B00] py-2">Log In</Link>
          <Link to="/signup" onClick={closeMenu} className="bg-[#FF6B00] text-white text-center py-3 rounded-xl shadow-md">
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
};

export default PublicNavbar;
