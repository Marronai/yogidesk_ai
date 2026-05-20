import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Mail, Phone, MapPin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate-950 text-slate-400 font-sans border-t border-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
        
        {/* Brand Information Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-xl">
            <div className="w-8 h-8 bg-[#FF6B00] rounded-lg flex items-center justify-center font-bold text-md text-white">Y</div>
            <span>Yogi Desk AI</span>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            India's premier WhatsApp Automation SaaS platform designed exclusively for Doctors, Clinics, and Hospitals to automate operations instantly.
          </p>
        </div>

        {/* Navigation Quick Links Section */}
        <div className="flex flex-col space-y-3 text-sm">
          <span className="text-white font-bold tracking-wider uppercase text-xs mb-1">Quick Links</span>
          <Link to="/" className="hover:text-[#FF6B00] transition">Home Dashboard</Link>
          <Link to="/about" className="hover:text-[#FF6B00] transition">About Our Vision</Link>
          <Link to="/pricing" className="hover:text-[#FF6B00] transition">Flexible Pricing</Link>
          <Link to="/contact" className="hover:text-[#FF6B00] transition">Connect Support</Link>
        </div>

        {/* Direct Contact Links Section */}
        <div className="flex flex-col space-y-3 text-sm text-slate-500">
          <span className="text-white font-bold tracking-wider uppercase text-xs mb-1">Contact Office</span>
          <div className="flex items-center gap-2"><MapPin size={16} className="text-[#FF6B00]"/> Patna, Bihar, India</div>
          <div className="flex items-center gap-2"><Mail size={16} className="text-[#FF6B00]"/> support@yogidesk-ai.com</div>
        </div>

      </div>

      {/* Trademark Copyright Block */}
      <div className="max-w-7xl mx-auto px-6 py-6 border-t border-slate-900 text-center text-xs text-slate-600 flex flex-col md:flex-row justify-between items-center gap-4">
        <p>© 2026 Yogi Desk AI. Built and Managed by Vyapar Wallah Media Team.</p>
        <p className="flex items-center gap-1">
          Made with <Heart size={14} className="text-red-500 fill-red-500"/> in India for better patient care.
        </p>
      </div>
    </footer>
  );
};

export default Footer;