import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';

const Section = ({ number, title, children }) => (
  <section className="scroll-mt-24 border-b border-slate-200 pb-8 last:border-0 last:pb-0 sm:pb-10">
    <div className="flex items-start gap-3 sm:gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF6B00] text-sm font-black text-white sm:h-10 sm:w-10">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-black leading-tight text-[#111827] sm:text-2xl">{title}</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">{children}</div>
      </div>
    </div>
  </section>
);

const Terms = () => {
  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans text-[#111827]">
      <header className="relative overflow-hidden bg-[#111827] px-4 pb-14 pt-16 text-white sm:px-6 sm:pb-20 sm:pt-20">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#FF6B00]/15 blur-3xl" />
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6B00] shadow-lg shadow-orange-950/30 sm:h-14 sm:w-14">
            <ShieldCheck size={28} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FF6B00]">YogiDesk AI Legal</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Terms of Service</h1>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 sm:text-sm">
            <CalendarDays size={15} className="text-[#FF6B00]" />
            Last Updated: June 1, 2025
          </div>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 rounded-2xl border border-orange-100 bg-orange-50 p-5 text-sm leading-7 text-slate-700 sm:rounded-3xl sm:p-8 sm:text-base sm:leading-8">
            <p>
              Welcome to YogiDesk AI (&quot;we,&quot; &quot;us,&quot; &quot;our,&quot; or the &quot;Platform&quot;), accessible at{' '}
              <a href="https://www.yogidesk-ai.com" className="break-words font-bold text-[#FF6B00] hover:underline">yogidesk-ai.com</a>, owned and operated by Vyapar Wallah Media &amp; Marketing (&quot;Company,&quot; &quot;Parent Company&quot;), having its registered office at New Alkapuri Gardanibhag Road No. 14, Patna, Bihar, 800002, India.
            </p>
            <p className="mt-4">
              These Terms of Service (&quot;Terms&quot;) govern your access to and use of the YogiDesk AI platform, dashboard, WhatsApp Business API integration services, AI assistant features, and any related services (collectively, the &quot;Services&quot;). By creating an account, accessing the dashboard, or using the Services, you (&quot;User,&quot; &quot;Client,&quot; &quot;you&quot;) agree to be bound by these Terms. If you do not agree, please do not use the Services.
            </p>
          </div>

          <div className="space-y-8 sm:space-y-10">
            <Section number="01" title="About the Service">
              <p>YogiDesk AI is a WhatsApp Business API communication and automation platform, designed specifically for healthcare professionals, including specialty doctors, hospitals, and clinics, to manage patient communication, appointment reminders, template-based messaging, and AI-assisted conversations through WhatsApp.</p>
              <p>The Services include, but are not limited to:</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-[#FF6B00]">
                <li>A user dashboard to manage WhatsApp Business API messaging</li>
                <li>Creation and sending of WhatsApp template messages (subject to Meta&apos;s approval and per-message charges)</li>
                <li>An integrated AI Assistant feature, available on a rechargeable/credit basis</li>
                <li>Subscription-based plans for dashboard access and usage</li>
              </ul>
            </Section>

            <Section number="02" title="Eligibility and Account Registration">
              <p><strong>2.1.</strong> To use the Services, you must register an account on the Platform and provide accurate, current, and complete information, including business/clinic details and a valid WhatsApp Business number.</p>
              <p><strong>2.2.</strong> You must be a legally registered medical practitioner, clinic, hospital, or healthcare-related business entity authorized to operate in India, or as otherwise permitted by us.</p>
              <p><strong>2.3.</strong> You are solely responsible for maintaining the confidentiality of your account login credentials and for all activities that occur under your account.</p>
              <p><strong>2.4.</strong> We reserve the right to refuse registration or terminate accounts at our sole discretion, including for incomplete, false, or misleading information.</p>
            </Section>

            <Section number="03" title="Subscription Plans and Billing">
              <p><strong>3.1.</strong> Access to the dashboard and core features of the Platform requires the User to subscribe to one of our available paid plans, as listed on the Platform from time to time.</p>
              <p><strong>3.2.</strong> Plan fees are charged on a monthly/annual basis and are payable in advance. Plans may be upgraded, downgraded, or modified by the User as permitted on the dashboard.</p>
              <p><strong>3.3. Template Message Charges:</strong> Sending WhatsApp template messages incurs a per-message conversation charge, which is levied by Meta Platforms, Inc. (&quot;Meta&quot;) as per WhatsApp Business API&apos;s official pricing. This charge is passed on to the User and is separate from the subscription plan fee. Meta&apos;s pricing is subject to change at Meta&apos;s sole discretion, and we are not responsible for such changes.</p>
              <p><strong>3.4. AI Assistant Recharge:</strong> The AI Assistant feature operates on a prepaid recharge/credit basis. Users must maintain a sufficient balance to continue using AI Assistant features. Unused credits/balance are non-refundable. Message Credit is valid for up to one year from the purchase date.</p>
              <p><strong>3.5.</strong> All fees are exclusive of applicable taxes (including GST), which shall be charged additionally as per prevailing Indian tax laws.</p>
              <p><strong>3.6.</strong> We reserve the right to revise pricing, plans, and charges at any time, with prior notice to Users via the dashboard, email, or WhatsApp.</p>
              <p><strong>3.7.</strong> Non-payment or failure to maintain sufficient recharge balance may result in suspension or limitation of Services, including suspension of message sending and AI Assistant functions.</p>
            </Section>

            <Section number="04" title="WhatsApp Business API and Meta Policies">
              <p><strong>4.1.</strong> The Services are built on the WhatsApp Business API, provided and governed by Meta Platforms, Inc. Users agree to comply with Meta&apos;s WhatsApp Business Policy, Commerce Policy, and all applicable Meta terms, in addition to these Terms.</p>
              <p><strong>4.2.</strong> We act as a technology service provider / Business Solution Provider (BSP) facilitating access to the WhatsApp Business API and are not responsible for Meta&apos;s policy changes, account approvals, rejections, bans, or template rejections, which are solely at Meta&apos;s discretion.</p>
              <p><strong>4.3.</strong> Users are solely responsible for the content of messages, templates, and communications sent through the Platform and must ensure such content complies with Meta&apos;s policies, applicable healthcare advertising/communication regulations, and Indian law.</p>
              <p><strong>4.4.</strong> We reserve the right to suspend or terminate access if a User&apos;s WhatsApp Business Account is flagged, restricted, or banned by Meta for policy violations.</p>
            </Section>

            <Section number="05" title="AI Assistant Feature">
              <p><strong>5.1.</strong> The AI Assistant is an automated, artificial-intelligence-based feature designed to assist with patient queries, appointment-related communication, and similar use cases.</p>
              <p><strong>5.2.</strong> AI-generated responses are provided &quot;as-is&quot; and may not always be accurate, complete, or appropriate for every situation. The AI Assistant must not be relied upon for providing medical advice, diagnosis, or treatment to patients. Users remain solely responsible for verifying and overseeing all communications sent to patients, including those generated or assisted by the AI Assistant.</p>
              <p><strong>5.3.</strong> We do not guarantee the accuracy, reliability, or availability of the AI Assistant feature at all times.</p>
              <p><strong>5.4.</strong> Usage of the AI Assistant is metered and billed against the User&apos;s recharge balance as described in Section 3.4.</p>
            </Section>

            <Section number="06" title="Healthcare Data and Patient Privacy">
              <p><strong>6.1.</strong> Users acknowledge that they may process patient personal data, including potentially sensitive personal data (such as health information), through the Platform.</p>
              <p><strong>6.2.</strong> Users are solely responsible for obtaining necessary patient consent for communication via WhatsApp and for complying with all applicable healthcare data protection laws, including the Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, and any applicable medical council or healthcare regulations in India.</p>
              <p><strong>6.3.</strong> We act as a data processor/intermediary facilitating message transmission and shall handle data in accordance with our <Link to="/privacy-policy" className="font-bold text-[#FF6B00] hover:underline">Privacy Policy</Link>. We do not access, use, or disclose patient data for purposes other than providing the Services, except as required by law.</p>
              <p><strong>6.4.</strong> Users must not upload, transmit, or process any data through the Platform that is unlawfully obtained or that violates patient confidentiality obligations.</p>
            </Section>

            <Section number="07" title="Acceptable Use">
              <p>You agree not to use the Platform to:</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-[#FF6B00]">
                <li>Send unsolicited bulk messages (spam) or messages without proper patient consent/opt-in</li>
                <li>Transmit unlawful, defamatory, obscene, or misleading content</li>
                <li>Misrepresent medical credentials or make false health claims</li>
                <li>Violate any applicable law, including the Indian Medical Council (Professional Conduct) Regulations, Drugs and Magic Remedies (Objectionable Advertisements) Act, or similar healthcare advertising restrictions</li>
                <li>Reverse-engineer, resell, or sublicense the Platform without our written consent</li>
                <li>Interfere with the security or proper functioning of the Platform</li>
              </ul>
              <p>We reserve the right to suspend or terminate accounts found in violation of this section, without prior notice in cases of serious or repeated violations.</p>
            </Section>

            <Section number="08" title="Intellectual Property">
              <p><strong>8.1.</strong> The Platform, including its software, design, dashboard, AI models/integrations, trademarks (&quot;YogiDesk AI&quot;), and all related intellectual property, is owned by Vyapar Wallah Media &amp; Marketing or its licensors.</p>
              <p><strong>8.2.</strong> Users are granted a limited, non-exclusive, non-transferable license to use the Platform solely for their internal business purposes during the subscription term.</p>
              <p><strong>8.3.</strong> Users retain ownership of their own data, content, and patient communications uploaded to the Platform.</p>
            </Section>

            <Section number="09" title="Service Availability and Limitation of Liability">
              <p><strong>9.1.</strong> We strive to maintain Platform uptime but do not guarantee uninterrupted, error-free, or continuous availability of the Services, including due to factors outside our control (e.g., Meta/WhatsApp downtime, internet outages, third-party service failures).</p>
              <p><strong>9.2.</strong> To the maximum extent permitted under applicable Indian law, our total liability arising out of or relating to the Services shall not exceed the amount paid by the User towards subscription fees in the three (3) months preceding the claim.</p>
              <p><strong>9.3.</strong> We shall not be liable for any indirect, incidental, special, or consequential damages, including loss of profits, data, goodwill, or patient relationships, arising from use of or inability to use the Platform.</p>
              <p><strong>9.4.</strong> We are not liable for any medical decisions, outcomes, or communications made by Users to their patients, whether or not facilitated through the AI Assistant.</p>
            </Section>

            <Section number="10" title="Termination">
              <p><strong>10.1.</strong> Users may terminate their account at any time by providing written notice as per the cancellation process described on the dashboard or by contacting support.</p>
              <p><strong>10.2.</strong> We may suspend or terminate access to the Services, with or without notice, for breach of these Terms, non-payment, suspicious activity, or as required by law or Meta&apos;s policies.</p>
              <p><strong>10.3.</strong> Upon termination, accrued and unpaid fees become immediately due. Unused recharge balances or subscription fees will not be refunded, as per our refund policy.</p>
            </Section>

            <Section number="11" title="Governing Law and Dispute Resolution">
              <p><strong>11.1.</strong> These Terms shall be governed by and construed in accordance with the laws of India.</p>
              <p><strong>11.2.</strong> Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts at Patna, Bihar, India.</p>
              <p><strong>11.3.</strong> An arbitration clause may be added under the Arbitration and Conciliation Act, 1996, if arbitration is preferred over courts.</p>
            </Section>

            <Section number="12" title="Changes to These Terms">
              <p>We reserve the right to modify or update these Terms at any time. Material changes will be communicated to Users via email, WhatsApp, or dashboard notification. Continued use of the Services after such changes constitutes acceptance of the revised Terms.</p>
            </Section>

            <Section number="13" title="Disclaimer">
              <div className="rounded-2xl border-l-4 border-[#FF6B00] bg-orange-50 p-4 font-bold uppercase text-[#111827] sm:p-6">
                The Platform and all Services (including the AI Assistant) are provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, express or implied. We do not warrant that the Services will be error-free, secure, or that they will meet your specific requirements.
              </div>
            </Section>

            <Section number="14" title="Contact Us">
              <p>If you have any questions, concerns, or grievances regarding these Terms or the Services, please contact us at:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#111827] p-5 text-white sm:col-span-2">
                  <p className="text-lg font-black">YogiDesk AI</p>
                  <p className="mt-1 text-sm text-slate-300">A product of Vyapar Wallah Media &amp; Marketing</p>
                </div>
                <div className="flex gap-3 rounded-2xl border border-slate-200 p-4">
                  <MapPin className="mt-1 shrink-0 text-[#FF6B00]" size={20} />
                  <p>New Alkapuri Gardanibhag Road No. 14, Patna, Bihar, 800002, India</p>
                </div>
                <a href="mailto:support@yogidesk-ai.com" className="flex min-w-0 gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-[#FF6B00]">
                  <Mail className="mt-1 shrink-0 text-[#FF6B00]" size={20} />
                  <span className="min-w-0 break-all">support@yogidesk-ai.com</span>
                </a>
                <a href="tel:+919187641492" className="flex gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-[#FF6B00]">
                  <Phone className="mt-1 shrink-0 text-[#FF6B00]" size={20} />
                  <span>+91 9187641492</span>
                </a>
                <a href="https://www.yogidesk-ai.com" className="flex min-w-0 gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-[#FF6B00]">
                  <span className="mt-0.5 shrink-0 text-lg text-[#FF6B00]">🌐</span>
                  <span className="min-w-0 break-all">www.yogidesk-ai.com</span>
                </a>
              </div>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Terms;
