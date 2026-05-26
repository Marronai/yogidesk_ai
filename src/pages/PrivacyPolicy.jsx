import React from 'react';
import { useWallet } from '../context/WalletContext';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Page Header */}
      <div className="bg-black py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-[#FF6B00] mb-4">Privacy Policy</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">Last Updated: May 7, 2026</p>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto py-12 px-6 leading-relaxed">
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">1. Introduction</h2>
          <p className="mb-4 text-gray-700">
            Welcome to <strong>Yogi Desk</strong>. We are committed to protecting your personal information and your right to privacy. This policy applies to all information collected through our website (yogidesk-ai.com) and our WhatsApp CRM services.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">2. Information We Collect</h2>
          <p className="mb-2 text-gray-700">We collect data that is necessary to provide a seamless automation experience:</p>
          <ul className="list-disc ml-6 space-y-2 text-gray-700">
            <li><strong>Personal Data:</strong> Name, Email, and Phone number provided during signup.</li>
            <li><strong>Business Data:</strong> Meta WABA ID, Access Tokens, and Template content.</li>
            <li><strong>Usage Data:</strong> IP addresses and browser types collected for security monitoring.</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">3. How We Use Data</h2>
          <p className="text-gray-700">
            Your data is used strictly to facilitate WhatsApp messaging via Meta's Official Cloud API. We implement <strong>Hacker-Proof Security</strong> protocols to prevent unauthorized access. We do not sell or trade your personal information to third parties.
          </p>
        </section>

        <section className="mb-10 text-center bg-gray-50 p-8 rounded-xl border border-gray-200">
          <h2 className="text-xl font-bold text-black mb-2">Questions about our Policy?</h2>
          <p className="text-gray-600 mb-4">Feel free to contact our support team at Patna, Bihar.</p>
          <button className="bg-[#FF6B00] text-white px-6 py-2 rounded-lg font-bold hover:bg-orange-600 transition">
            Contact Support
          </button>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;