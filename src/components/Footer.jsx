import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Twitter, Instagram, Linkedin } from 'lucide-react';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

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
              <li><Link to="/status" onClick={scrollToTop} className="hover:text-[#FF6B00] transition">System Status</Link></li>
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
    </footer>
  );
};

export default Footer;
