import React from 'react';
import { ShieldCheck, FileText, Scale, AlertTriangle } from 'lucide-react';

const TermsConditions = () => {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased selection:bg-orange-100">
      {/* Premium Elegant Header */}
      <div className="border-b border-gray-100 bg-gradient-to-b from-blue-50/30 to-white py-14">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold mb-4 tracking-wide uppercase">
            <Scale size={14} className="text-blue-600" /> Legal Framework
          </div>
          <h1 className="text-4xl font-extrabold text-black tracking-tight mb-3">
            Terms & Conditions
          </h1>
          <p className="text-gray-500 text-sm">
            Last Updated: May 18, 2026 | Effective for all Yogi Desk AI Healthcare Workspaces
          </p>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Quick Sticky Navigation Links */}
          <div className="md:col-span-1">
            <div className="sticky top-6 bg-gray-50/80 backdrop-blur rounded-2xl p-4 border border-gray-100 space-y-1.5">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400 px-2 mb-2">Sections</p>
              <a href="#acceptance" className="block text-sm font-medium text-gray-600 hover:text-orange-600 px-2 py-1.5 rounded-lg transition-colors">1. Acceptance of Terms</a>
              <a href="#healthcare" className="block text-sm font-medium text-gray-600 hover:text-orange-600 px-2 py-1.5 rounded-lg transition-colors">2. Healthcare Scope</a>
              <a href="#account" className="block text-sm font-medium text-gray-600 hover:text-orange-600 px-2 py-1.5 rounded-lg transition-colors">3. Staff Accounts</a>
              <a href="#data-governance" className="block text-sm font-medium text-gray-600 hover:text-orange-600 px-2 py-1.5 rounded-lg transition-colors">4. Patient Data Ledger</a>
              <a href="#billing" className="block text-sm font-medium text-gray-600 hover:text-orange-600 px-2 py-1.5 rounded-lg transition-colors">5. Wallet & Rates</a>
              <a href="#liability" className="block text-sm font-medium text-gray-600 hover:text-orange-600 px-2 py-1.5 rounded-lg transition-colors">6. Liability Caps</a>
            </div>
          </div>

          {/* Legal Text Panel */}
          <div className="md:col-span-3 space-y-10 text-gray-700 leading-relaxed text-sm md:text-base">
            
            <blockquote>
              <strong>Important Notice for Indian Healthcare Providers:</strong> This document is compliant with the Information Technology Act, 2000 and the Digital Personal Data Protection (DPDP) Act, 2023 of India. By activating your clinic workspace, you acknowledge strict compliance.
            </blockquote>

            {/* Section 1 */}
            <section id="acceptance" className="scroll-mt-6">
              <h2 className="text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account, accessing, or utilizing the Yogi Desk AI platform ("Service"), you ("Admin", "Doctor", "Clinic") agree to bound by these Terms and Conditions. If you are entering into this agreement on behalf of a medical facility, clinic, or hospital, you represent that you have the legal authority to bind such entity.
              </p>
            </section>

            {/* Section 2 */}
            <section id="healthcare" className="scroll-mt-6">
              <h2 className="text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                2. Strict Healthcare & Medical Scope
              </h2>
              <p className="mb-2">
                Yogi Desk AI is exclusively structured as a WhatsApp Cloud API CRM for registered healthcare practices, clinical environments, and hospital networks. 
              </p>
              <div className="bg-orange-50/50 border-l-4 border-orange-500 p-3 rounded-r-xl my-3 text-sm text-gray-800">
                <div className="flex gap-2 font-semibold text-orange-800 mb-1">
                  <AlertTriangle size={16} /> Emergency Services Restriction
                </div>
                The platform is designed strictly for operational communications (e.g., appointment reminders, follow-ups, general health awareness broadcasts). It <strong>MUST NOT</strong> be used as an emergency response communication channel or medical diagnostic tool.
              </div>
            </section>

            {/* Section 3 */}
            <section id="account" className="scroll-mt-6">
              <h2 className="text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="w-1.5 h-6 bg-black rounded-full"></span>
                3. User Onboarding & Staff Credentials
              </h2>
              <p>
                As an Admin, you are granted user seats depending on your active subscription tier (Starter, Growth, Multi-Specialty). You are entirely responsible for:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2 text-gray-600">
                <li>Ensuring that a separate account is created for every individual receptionist or staff agent.</li>
                <li>Maintaining the strict absolute confidentiality of login passwords.</li>
                <li>All clinical logging, internal yellow-highlighted Private Notes, and chat transfers performed via your account console wrapper.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="data-governance" className="scroll-mt-6">
              <h2 className="text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
                4. Patient Data Ledger & Privacy Ownership
              </h2>
              <p className="mb-2">
                Our application stores and maintains patient data records inside a centralized Live Patients Ledger ecosystem. This includes patient full names, strictly formatted 10-digit mobile numbers, and upcoming appointment logging parameters.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-gray-600">
                <li><strong>Data Processor Status:</strong> Yogi Desk AI acts purely as a <em>Data Processor</em> under the Indian DPDP Act, 2023. The Clinic/Hospital remains the sole <em>Data Fiduciary</em>.</li>
                <li><strong>Patient Consent:</strong> It is the exclusive legal duty of the clinic/doctor to ensure that valid explicit consent has been procured from patients before uploading their records or executing automated WhatsApp message broadcasts.</li>
                <li><strong>Deletion & Pricing Guard:</strong> Deleting a patient profile row from your live dashboard grid hides the record from active list grids but **does not erase or deduct** the metadata instance tracking metrics from your lifetime tier limit cap (e.g., 500 or 2,000 threshold limits).</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="billing" className="scroll-mt-6">
              <h2 className="text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>
                5. Prepaid Wallet Engine & Deductions
              </h2>
              <p>
                All message logs executed via Yogi Desk AI are processed dynamically using our transparent pay-per-message wallet setup framework:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2 text-gray-600">
                <li>Utility and appointment logging templates are auto-deducted at a fixed rate of **Rs. 0.20 per message**.</li>
                <li>Marketing and custom awareness broadcasts are auto-deducted at **Rs. 0.90 per message**.</li>
                <li>If your balance hits Rs. 0.00, delivery loops automatically lock. Manual wallet top-ups must be routed to our dynamic UPI configuration pointer: <code className="bg-gray-100 px-1 py-0.5 rounded text-black font-mono">yogidesk@icici</code>.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="liability" className="scroll-mt-6">
              <h2 className="text-lg font-bold text-black flex items-center gap-2 mb-3">
                <span className="w-1.5 h-6 bg-gray-400 rounded-full"></span>
                6. Limitation of Liability
              </h2>
              <p>
                Yogi Desk AI, its developers, or affiliates shall not be held legally liable for any direct, indirect, or incidental damage resulting from:
              </p>
              <ul className="list-disc pl-5 space-y-1 mt-2 text-gray-600">
                <li>WhatsApp number bans or blocks imposed directly by Meta platforms due to improper transmission frequencies or patient spam reports.</li>
                <li>Loss of patient chat logs due to credential negligence by staff agents.</li>
                <li>Network communication dropouts or "Failed to fetch" client errors caused by local infrastructure constraints.</li>
              </ul>
            </section>

            <hr className="border-gray-100" />

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 flex items-start gap-3">
              <ShieldCheck className="text-blue-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-bold text-black mb-1">Legal Enforcement Contact</p>
                <p className="text-xs text-gray-500">
                  For official legal compliance, DPDP data protection inquiries, or arbitration requests, reach out directly via secure encryption channels to: <span className="text-black font-medium">legal@yogidesk.com</span>
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;