import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact Us', to: '/contact' },
];

const PublicNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname, hash } = useLocation();

  const isActive = (to) => {
    if (to === '/#features') return pathname === '/' && hash === '#features';
    if (to === '/') return pathname === '/' && hash !== '#features';
    return pathname === to;
  };

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex justify-between items-center">
        <Link to="/" className="flex h-11 md:h-12 lg:h-14 items-center shrink-0" aria-label="Yogi Desk AI home">
          <img
            src="/assets/yogidesk-logo.png"
            alt="Yogi Desk AI"
            className="h-11 md:h-12 lg:h-14 w-auto object-contain"
          />
        </Link>

        <div className="hidden lg:flex gap-8 text-sm font-bold text-slate-600 items-center">
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
          {navLinks.map((item) => (
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
