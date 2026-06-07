import React from 'react';
import { useWallet } from '../context/WalletContext';

const TermsConditions = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Page Header */}
      <div className="bg-black py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-[#FF6B00] mb-4">Terms & Conditions</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">Effective Date: June 1, 2025 | Last Updated: June 7, 2026</p>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto py-12 px-6 leading-relaxed">
        
        {/* Introduction Block */}
        <section className="mb-10 bg-slate-50 p-6 rounded-lg border-l-4 border-[#FF6B00]">
          <p className="text-gray-700 mb-3">
            <strong>Welcome to YogiDesk-AI</strong> (the "Platform", "Services"). This platform is owned, managed, and operated by <strong>Vyapar Wallah Media & Marketing</strong>, a registered business entity under the laws of India.
          </p>
          <p className="text-gray-700">
            By registering an account, subscribing to our workspace plans, or using our automated assistant protocols on <a href="https://www.yogidesk-ai.com" className="text-[#FF6B00] hover:text-orange-600 font-semibold">www.yogidesk-ai.com</a>, you agree to be bound by the following Terms and Conditions. Please read them carefully before initiating any financial transactions.
          </p>
        </section>

        {/* Section 1 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">1. Eligibility & Healthcare Compliance</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg mb-4">
            <h3 className="font-bold text-gray-800 mb-2">Professional Licensing</h3>
            <p className="text-gray-700 mb-3">Our services are strictly intended for licensed healthcare professionals, doctors, clinics, medical specialists, and hospitals operating legally within the jurisdiction of India.</p>
            
            <h3 className="font-bold text-gray-800 mb-2">Account Verification</h3>
            <p className="text-gray-700">By onboarding, you represent that you hold a valid registration number issued by the Medical Council of India (MCI), State Medical Council (SMC), or relevant regulatory authority. We reserve the right to suspend accounts failing authentication checks.</p>
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">2. Nature of Service & White-Label Isolation</h2>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-3">
                YogiDesk-AI provides a multi-tenant technology framework integrating automated artificial intelligence pipelines (via official API channels) and Meta's WhatsApp Business interface to manage administrative workflows, reminders, and patient communication.
              </p>
              
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-gray-800 font-semibold mb-2">⚠️ No Medical Advice</p>
                <p className="text-gray-700">
                  The Platform's automated assistant features are strictly communication and administrative utility tools. YogiDesk-AI does <strong>NOT</strong> provide clinical diagnosis, medical interpretations, or treatment recommendations. All professional medical judgments remain the sole liability of the registered healthcare provider.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">3. Commercial Workspace Plans & Payment Processing</h2>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-2">Subscription Billing</h3>
              <p className="text-gray-700 mb-4">All commercial plans (Starter, Growth, Multi-Specialty) are detailed explicitly on our pricing matrix transparently in Indian Rupees (INR).</p>
              
              <h3 className="font-bold text-gray-800 mb-2">Payment Gateway Security</h3>
              <p className="text-gray-700 mb-4">All subscription payments and digital top-ups are processed securely via RBI-authorized, PCI-DSS compliant payment aggregators (such as Razorpay). YogiDesk-AI does not store your core payment card variables, net banking login parameters, or UPI PIN data on its internal cloud network.</p>
              
              <h3 className="font-bold text-gray-800 mb-2">Server-Side Validation</h3>
              <p className="text-gray-700">All transaction parameters, plan values, and token caps are strictly locked server-side. Any intentional manipulation of frontend interface elements to alter plan parameters constitutes a breach of contract and results in immediate workflow termination.</p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">4. Cancellation & Refund Protocols (Strict Razorpay Compliance)</h2>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-2">Trial & Commitments</h3>
              <p className="text-gray-700 mb-4">We provide trial resources/tokens for structural evaluation before initial commitment.</p>
              
              <h3 className="font-bold text-gray-800 mb-2">Refund Window</h3>
              <p className="text-gray-700 mb-4">Once a payment is confirmed and processed via the secure gateway, subscription charges are non-refundable since token bandwidth and operational APIs are allocated instantly to your workspace.</p>
              
              <h3 className="font-bold text-gray-800 mb-2">Cancellation Strategy</h3>
              <p className="text-gray-700">Users can pause or deactivate their billing cycles at any point directly via the account settings panel. Upon deactivation, your system remains active until the end of the current pre-paid duration cycle, after which automatic renewal billing terminates.</p>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">5. Fair Use & API Token Consumption Caps</h2>
          
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-gray-700 mb-4">Local user authentications operate under predefined system consumption ceilings (such as monthly token allocations and message counters).</p>
              
              <h3 className="font-bold text-gray-800 mb-2">Hybrid OTP Controls</h3>
              <p className="text-gray-700 mb-4">To avoid continuous over-billing, user login cycles are capped at a set number of mobile SMS dispatches per account per month. Once this threshold is crossed, the authentication tree gracefully switches back to zero-cost secure Email verification protocols.</p>
              
              <h3 className="font-bold text-gray-800 mb-2">System Abuse</h3>
              <p className="text-gray-700">Mass spamming, illegal broadcast contents, or scripts running data-mining routines on our API network will trigger automatic system locks without liability for refund.</p>
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">6. Strict Tenant Isolation & Cyber-Security Framework</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-gray-700 mb-4">
              In accordance with the <strong>Information Technology Act, 2000</strong> and the <strong>Digital Personal Data Protection Act (DPDPA), 2023</strong>, YogiDesk-AI isolates clinical records, knowledge nodes, and text structures per doctor via strict structural Row-Level Security parameters.
            </p>
            
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded">
              <p className="text-gray-800 font-semibold mb-2">🔒 Cyber-Security Threat Response</p>
              <p className="text-gray-700">
                Attempting to inject malicious code, run unauthorized endpoint calls, or gain cross-tenant backend clearance will immediately be handled as a cyber-security threat and reported directly to <strong>CERT-In</strong> (Indian Computer Emergency Response Team) within 6 hours.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">7. Intellectual Property & Brand Abstraction</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-gray-700 mb-3">
              All software source frameworks, styling formats, logic trees, UI modules, and brand properties connected with <strong>YogiDesk-AI</strong> and <strong>Vyapar Wallah Media & Marketing</strong> are protected under copyright laws.
            </p>
            <p className="text-gray-700">
              No doctor, subscriber, or platform developer is authorized to mirror, duplicate, or dismantle our components to construct derivative applications or bypass active white-labeling configurations.
            </p>
          </div>
        </section>

        {/* Section 8 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">8. Dispute Resolution & Governing Law</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-gray-700 mb-4">
              These Terms and Conditions shall be interpreted and governed explicitly under the legal framework of the <strong>Republic of India</strong>.
            </p>
            <p className="text-gray-700 mb-3">
              Any disputes, transactional mismatches, or claims shall first be routed to our Grievance Desk at <a href="mailto:privacy@yogidesk-ai.com" className="text-[#FF6B00] hover:text-orange-600 font-semibold">privacy@yogidesk-ai.com</a> for informal mediation within 30 days.
            </p>
            <p className="text-gray-700">
              If mediation fails, final adjustments will fall under the exclusive jurisdiction of competent courts in India.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-16 text-center bg-gray-50 p-8 rounded-xl border border-gray-200">
          <h2 className="text-xl font-bold text-black mb-2">Have Questions About These Terms?</h2>
          <p className="text-gray-600 mb-6">Our support team is here to help clarify any part of our Terms and Conditions.</p>
          <a href="mailto:privacy@yogidesk-ai.com" className="inline-block bg-[#FF6B00] text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-600 transition">
            Contact Us
          </a>
        </section>
      </div>
    </div>
  );
};

export default TermsConditions;