import React from 'react';
import { useWallet } from '../context/WalletContext';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Page Header */}
      <div className="bg-black py-16 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-[#FF6B00] mb-4">Privacy Policy</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">Effective Date: June 1, 2025 | Last Updated: June 7, 2026 | Version: 1.1</p>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto py-12 px-6 leading-relaxed">
        
        {/* Introduction Block */}
        <section className="mb-10 bg-slate-50 p-6 rounded-lg border-l-4 border-[#FF6B00]">
          <p className="text-gray-700 mb-3">
            <strong>YogiDesk-AI</strong> ("the Platform", "we", "us", or "our") is a medical-administrative communication platform built exclusively for licensed healthcare institutions and professionals in India. YogiDesk-AI operates under the parent organization <strong>Vyapar Wallah Media & Marketing</strong>.
          </p>
          <p className="text-gray-700">
            This Privacy Policy defines how we collect, safeguard, process, and structure information when you access or configure your workspace on <a href="https://www.yogidesk-ai.com" className="text-[#FF6B00] hover:text-orange-600 font-semibold">www.yogidesk-ai.com</a>. We are committed to strict corporate transparency, compliance with local data protection acts, and the containment of medical information.
          </p>
        </section>

        {/* Section 1 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">1. Regulatory Alignment & Legal Framework</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-gray-700 mb-3">Our operational data structures are engineered to strictly adhere to the following national and global frameworks:</p>
            <ul className="space-y-3 text-gray-700">
              <li className="flex gap-3">
                <span className="text-[#FF6B00] font-bold">•</span>
                <span><strong>Digital Personal Data Protection Act, 2023 (DPDPA):</strong> Regulating the processing of digital personal data while balancing individual rights and lawful processing obligations.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#FF6B00] font-bold">•</span>
                <span><strong>Information Technology Act, 2000 (IT Act) & IT Rules, 2011:</strong> Directing reasonable cybersecurity measures and practices for handling Sensitive Personal Data or Information (SPDI).</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#FF6B00] font-bold">•</span>
                <span><strong>Telemedicine Practice Guidelines, 2020 (MoHFW):</strong> Ensuring confidentiality protocols governing digital patient-doctor interactions remain privileged.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">2. Information We Collect & Process</h2>
          
          <p className="text-gray-700 mb-4">To deliver automated administrative flows, we parse and process data split into distinct layers:</p>
          
          <div className="space-y-4">
            {/* Subsection A */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-3">A. Account Profile Parameters (Provided by Healthcare Professionals)</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex gap-3">
                  <span className="text-[#FF6B00]">▸</span>
                  <span>Full Name, business entity tags, specialized designations, and clinical location structures.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#FF6B00]">▸</span>
                  <span>Verified medical licensing descriptors (MCI/SMC registration codes) for compliance vetting.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#FF6B00]">▸</span>
                  <span>Contact nodes: Corporate email registers and WhatsApp channel variables.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#FF6B00]">▸</span>
                  <span>Billing identifiers: Corporate GSTIN codes and payment receipts.</span>
                </li>
              </ul>
            </div>

            {/* Subsection B */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-800 mb-3">B. Patient Interaction Elements (Processed as Data Processor)</h3>
              <ul className="space-y-2 text-gray-700 mb-4">
                <li className="flex gap-3">
                  <span className="text-[#FF6B00]">▸</span>
                  <span>Patient identity markers: Profile names, ages, contact integers, and appointment tracking stamps.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#FF6B00]">▸</span>
                  <span>Message logs: Queries regarding clinical timings, scheduling modifications, and fee queries.</span>
                </li>
              </ul>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-gray-800 font-semibold mb-2">⚠️ Important Notice</p>
                <p className="text-gray-700">
                  YogiDesk-AI operates solely as a technology intermediary (<strong>Data Processor</strong>). The onboarding Healthcare Provider (<strong>Data Fiduciary</strong>) holds primary responsibility for obtaining patient-side consent under relevant telemedicine guidelines before enabling automated processing loops.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">3. Absolute De-Identification & AI Governance (Google API Verification)</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Zero Model Training</h3>
              <p className="text-gray-700">YogiDesk-AI utilizes official advanced API pathways to power automated responses, message summarizations, and urgent routing hooks. We confirm that <strong>no raw patient data, medical charts, or diagnostic texts are utilized to train, fine-tune, or upgrade public or private AI language models.</strong></p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Scope Isolation</h3>
              <p className="text-gray-700">Conversations parsed through our AI sub-processors operate under rigid enterprise data protocols where prompts are immediately volatile and destroyed post-execution.</p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Clinical Boundary Protection</h3>
              <p className="text-gray-700">The Platform's AI layer is configured to deny clinical interpretation requests. If diagnostic data or medical lab files are submitted, the system triggers a secure fallback response to prompt a physical evaluation booking with the primary doctor.</p>
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">4. Financial Data Integrity (Razorpay Gateway Verification)</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Encryption Standard</h3>
              <p className="text-gray-700">YogiDesk-AI employs <strong>TLS 1.3</strong> encryption mechanisms for data in transit and <strong>AES-256</strong> blocks for configurations at rest.</p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Payment Credentials Deletion</h3>
              <p className="text-gray-700">All financial settlements, license acquisitions, and transactional renewals are managed directly by RBI-licensed, PCI-DSS compliant payment processing aggregators (such as Razorpay). <strong>YogiDesk-AI never captures, records, or caches debit/credit card numbers, expiry ranges, CVV codes, net banking pass-phrases, or UPI PIN variables on its local cloud hardware.</strong></p>
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">5. Non-Disclosure & Anti-Commercial Commitments</h2>
          
          <div className="bg-slate-50 p-4 rounded-lg space-y-4">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">No Sale of Data</h3>
              <p className="text-gray-700">We enforce an absolute, unconditional restriction against commercial data mining. YogiDesk-AI <strong>DOES NOT sell, lease, trade, rent, or distribute</strong> personal profiles, phone numbers, interaction patterns, or medical histories to external marketing groups, advertisement brokers, or third-party analytical entities.</p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Legal Interventions</h3>
              <p className="text-gray-700">Information disclosure will only materialize when directed by official mandates from authorized statutory courts or Indian cyber defense frameworks (such as CERT-In).</p>
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">6. Data Retention & Permanent Destruction Cycles</h2>
          
          <p className="text-gray-700 mb-4">Data is retained strictly for durations required under medical retention statutes and tax compliances:</p>
          <div className="bg-slate-50 p-4 rounded-lg space-y-3">
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Clinical Registries & Appointment Calendars</h3>
              <p className="text-gray-700">Retained under MCI mandates for a period of <strong>7 years</strong> (and adjusted up to age 25 for minor subjects).</p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Billing Records & Payment Metadata</h3>
              <p className="text-gray-700">Maintained for <strong>8 financial years</strong> to comply with statutory Income Tax and GST reporting protocols.</p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Ephemeral Message Traces</h3>
              <p className="text-gray-700">Erased from runtime operational memory caches within <strong>90 days</strong>. Exited or deprecated profiles undergo permanent programmatic cryptographic shredding.</p>
            </div>
          </div>
        </section>

        {/* Section 7 */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-[#FF6B00] mb-4 border-b-2 border-orange-100 pb-2">7. Data Principal Rights & Revocation</h2>
          
          <p className="text-gray-700 mb-4">Under the DPDPA 2023, users can invoke explicit management protocols over their data assets:</p>
          <div className="bg-slate-50 p-4 rounded-lg space-y-3">
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Right to Access & Correction</h3>
              <p className="text-gray-700">Users can check, adjust, or erase structural parameters via their profile modules.</p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Opt-Out Trigger</h3>
              <p className="text-gray-700">Patients can immediately terminate AI processing protocols by responding with <strong>"STOP"</strong> to the respective workspace numbers.</p>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Grievance Resolution</h3>
              <p className="text-gray-700">Any compliance mismatches or access queries can be explicitly filed with our Data Protection Desk at <a href="mailto:privacy@yogidesk-ai.com" className="text-[#FF6B00] hover:text-orange-600 font-semibold">privacy@yogidesk-ai.com</a>. All requests undergo validation checks and will be addressed within <strong>30 calendar days</strong>.</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-16 text-center bg-gray-50 p-8 rounded-xl border border-gray-200">
          <h2 className="text-xl font-bold text-black mb-2">Questions About Our Privacy Practices?</h2>
          <p className="text-gray-600 mb-6">Our Data Protection team is committed to transparency and regulatory compliance. Reach out with any concerns or requests.</p>
          <a href="mailto:privacy@yogidesk-ai.com" className="inline-block bg-[#FF6B00] text-white px-8 py-3 rounded-lg font-bold hover:bg-orange-600 transition">
            Contact Data Protection Desk
          </a>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;