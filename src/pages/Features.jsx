import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Megaphone,
  MessageSquareText,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';

const BRAND = {
  dark: '#111827',
  orange: '#FF6B00',
  white: '#FFFFFF',
  blue: '#2563EB',
};

const heroMetrics = [
  { label: 'Team response control', value: 'RBAC' },
  { label: 'Patient data import', value: 'CSV/XLSX' },
  { label: 'WhatsApp API readiness', value: 'Meta' },
];

const heroImage = {
  src: '/assets/features/features-hero.png',
  alt: 'YogiDesk AI healthcare WhatsApp CRM dashboard',
  label: 'Put hero image here: public/assets/features/features-hero.png',
};

const featureBlocks = [
  {
    id: 'staff-setup',
    eyebrow: 'Feature 01',
    title: 'Empower Your Clinic Team with Smart Staff Setup & Multi-Agent Communication',
    description:
      "Streamline your medical workspace operations using YogiDesk's advanced clinic team setup panel.",
    detail: '',
    points: [
      {
        title: 'Unified Staff Onboarding & Communication',
        body: 'Allow doctors and practice administrators to seamlessly onboard healthcare staff, receptionists, and nursing team members. Once added, your designated team can log in independently to trigger pre-approved WhatsApp message templates, automate patient updates, and handle daily practice inquiries efficiently.',
      },
      {
        title: 'Role-Based Access Control (RBAC)',
        body: 'Maintain strict compliance and clinical security within your practice. As the super-admin, the doctor can precisely decide and assign exact operational permissions for each receptionist or staff member, ensuring data privacy and restricted access.',
      },
      {
        title: 'Real-Time Team Chat Monitoring',
        body: "Maintain total quality control over the clinic's digital interactions from a single secure console. The master dashboard offers comprehensive real-time tracking, allowing the admin doctor to audit all patient communication and view active chat logs in flight.",
      },
    ],
    imageSrc: '/assets/features/staff-setup.png',
    imageAlt: 'Staff setup and multi-agent communication dashboard',
    imageNote: 'Put image here: public/assets/features/staff-setup.png',
    icon: UsersRound,
    accent: BRAND.orange,
    reverse: false,
    bullets: [
      'Role-based receptionist, nurse, and assistant access',
      'Doctor-owned super-admin permission controls',
      'Live communication monitoring for patient conversations',
      'Pre-approved WhatsApp template execution by staff',
    ],
    metrics: ['Staff seats', 'RBAC', 'Chat audit'],
  },
  {
    id: 'patient-directory',
    eyebrow: 'Feature 02',
    title: 'Effortless Patient Data Ingestion & Centralized Medical Contact Directory',
    description:
      "Eliminate tedious manual record-keeping with YogiDesk's frictionless patient data adder framework, designed to build a structured, actionable healthcare contact database.",
    detail: '',
    points: [
      {
        title: 'Flexible Multi-Channel Data Ingestion',
        body: 'Ingest patient details into the system using multiple flexible channels. For instant entries between consultations, the quick adder tool allows immediate input, while the robust bulk-upload engine supports native medical CSV and Excel (.xlsx) data sheet imports to migrate thousands of patient profiles effortlessly.',
      },
      {
        title: 'Dynamic Centralized Patient Directory',
        body: 'Populate processed records cleanly into a dynamic, filterable electronic patient directory displayed directly on the screen. This centralized data matrix serves as the ultimate launchpad for your entire WhatsApp patient communication strategy.',
      },
      {
        title: 'Targeted WhatsApp Communication Launchpad',
        body: 'Empower your authorized clinic team—including doctors, nurses, and desk staff—to utilize this verified database to instantly deploy operational notification templates, broadcast automation flows, and send critical medical alerts, ensuring a personalized and responsive healthcare experience for every patient.',
      },
    ],
    imageSrc: '/assets/features/patient-directory.png',
    imageAlt: 'Patient data ingestion and contact directory dashboard',
    imageNote: 'Put image here: public/assets/features/patient-directory.png',
    icon: Database,
    accent: BRAND.blue,
    reverse: true,
    bullets: [
      'Quick-add patient records between consultations',
      'Bulk CSV and Excel .xlsx patient import support',
      'Filterable centralized patient contact matrix',
      'Broadcast-ready verified medical contact database',
    ],
    metrics: ['CSV import', 'XLSX upload', 'Smart filters'],
  },
  {
    id: 'broadcast-streams',
    eyebrow: 'Feature 03',
    title: 'Automated Broadcast Streams for Appointment, Recall, and Care Campaigns',
    headline: 'Scale Patient Engagement Without Wasting Manual Hours',
    description:
      'YogiDesk ka smart automated messaging engine clinic staff ka load 80% tak kam kar deta hai aur patient retention badhata hai.',
    detail: '',
    points: [
      {
        title: 'Automated Patient Messaging Streams',
        body: 'Apne patients ko automated appointment reminders, follow-ups, aur health campaigns bina kisi manual touch ke direct WhatsApp par bhejein.',
      },
      {
        title: 'Shared Team Inbox Setup',
        body: 'Poori team ya clinic staff ek hi WhatsApp Number se multiple devices par patient queries ko reply kar sakte hain, jisse patient management super fast ho jata hai.',
      },
      {
        title: 'Private Staff Notes for Internal Chat',
        body: 'Admin ya senior doctor patient chat ke andar hi apne staff ko Hidden Private Notes bhej sakte hain, jo sirf staff ko dikhenge, patient ko nahi—perfect for team synchronization.',
      },
    ],
    imageSrc: '/assets/features/broadcast-streams.png',
    imageAlt: 'Automated WhatsApp broadcast stream dashboard',
    imageNote: 'Put image here: public/assets/features/broadcast-streams.png',
    icon: MessageSquareText,
    accent: BRAND.orange,
    reverse: false,
    metrics: ['Templates', 'Segments', 'Delivery'],
  },
  {
    id: 'ai-balance',
    eyebrow: 'Feature 04',
    title: 'Live AI Balance Tracking Loops with Usage Transparency',
    headline: '100% Billing Transparency with Real-Time Credit Intelligence',
    description:
      'Bina kisi hidden charge ke apne clinic marketing budget ko smartly track karein aur har ek paise ka real-time analytics dekhein.',
    detail: '',
    points: [
      {
        title: 'Real-Time AI Credit Intelligence',
        body: 'Apne dashboard par live check karein ki kitne AI credits baki hain, taaki aapka healthcare marketing campaign kabhi beech mein na ruke.',
      },
      {
        title: 'Complete Usage Transparency Visuals',
        body: 'Ek-ek paise ka hisab aapke samne hota hai; kis campaign mein, kis patient ke liye kitna balance use hua, sab transparently dikhta hai.',
      },
      {
        title: 'Granular Cost Audit Logs',
        body: 'Har ek message delivery aur consumption ka deeper record track karein taaki aap apne clinic ya hospital ka ROI (Return on Investment) aasan bhasha mein samajh sakein.',
      },
    ],
    imageSrc: '/assets/features/ai-balance.png',
    imageAlt: 'AI balance and usage tracking dashboard',
    imageNote: 'Put image here: public/assets/features/ai-balance.png',
    icon: BarChart3,
    accent: BRAND.blue,
    reverse: true,
    metrics: ['Credits', 'Usage', 'Reports'],
  },
  {
    id: 'campaign-manager',
    eyebrow: 'Feature 05',
    title: 'Smart Campaign Manager for Healthcare Marketing',
    headline: 'Blast High-Converting Bulk WhatsApp Messages Without Number Ban',
    description:
      'Apne hazaro patients ko ek click mein personal touch ke sath approach karein, bina kisi standard text limits ya blockage ke.',
    detail: '',
    points: [
      {
        title: '100% Secure Bulk WhatsApp Blaster',
        body: 'Meta API ke official framework ke sath unlimited patients ko ek sath messages bhejein, bina kisi temporary or permanent WhatsApp Number Ban ke risk ke.',
      },
      {
        title: 'Hyper-Personalized Patient Dynamic Fields',
        body: 'Har patient ko unke real name, appointment date, aur doctor ke naam ke sath tailored message bhejein, jisse patient trust 10X badh jata hai.',
      },
      {
        title: 'Advanced Dynamic Template Editor',
        body: 'Apne healthcare templates ko real-time par customize aur edit karein, aur pichle campaigns ka conversion response data dekh kar messaging strategy optimize karein.',
      },
    ],
    imageSrc: '/assets/features/campaign-manager.png',
    imageAlt: 'Healthcare WhatsApp campaign manager dashboard',
    imageNote: 'Put image here: public/assets/features/campaign-manager.png',
    icon: Megaphone,
    accent: BRAND.orange,
    reverse: false,
    metrics: ['Bulk messaging', 'Dynamic fields', 'Templates'],
  },
  {
    id: 'template-creation',
    eyebrow: 'Feature 06',
    title: '20-Second Doctor-Centric Template Creation System',
    headline: 'Craft High-Quality Meta Approved WhatsApp Templates Instantly',
    description:
      'Doctors aur hospital owners ke busy schedule ko dhyan mein rakh kar banaya gaya ek super-fast interactive template builder.',
    detail: '',
    points: [
      {
        title: '20-Second High-Quality Drafting Engine',
        body: 'Doctors aur clinic managers ke liye pre-designed structure, jisse sirf 20 seconds ke andar super-premium aur clinical-grade templates ready ho jaate hain.',
      },
      {
        title: 'Rich Multimedia Attachment Support',
        body: 'Apne templates mein clickable buttons ke sath high-resolution images, explainer videos, patient prescription sheets, aur clinic brochures (PDF) aaram se attach karein.',
      },
      {
        title: 'Instant Meta Approval Compliance',
        body: 'YogiDesk ka system Meta API ke internal validation guidelines ko follow karta hai, jisse aapke custom templates ko instant approval milta hai aur campaigns turant live ho jaate hain.',
      },
    ],
    imageSrc: '/assets/features/template-creation.png',
    imageAlt: 'Doctor-centric WhatsApp template creation system',
    imageNote: 'Put image here: public/assets/features/template-creation.png',
    icon: FileText,
    accent: BRAND.blue,
    reverse: true,
    metrics: ['20-second drafts', 'Rich media', 'Meta ready'],
  },
];

const ImageDepth = ({ accent }) => (
  <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
    <div
      className="absolute -right-8 top-8 h-40 w-40 rounded-full blur-3xl animate-pulse"
      style={{ backgroundColor: `${accent}33` }}
    />
    <div
      className="absolute -left-10 bottom-6 h-44 w-44 rounded-full blur-3xl animate-pulse"
      style={{ backgroundColor: `${BRAND.blue}2E`, animationDelay: '700ms' }}
    />
    <div
      className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl animate-pulse"
      style={{ backgroundColor: `${BRAND.orange}24`, animationDelay: '1200ms' }}
    />
  </div>
);

const ImageSlot = ({ src, alt, note, accent }) => {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <ImageDepth accent={accent} />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/20 bg-white p-3 shadow-2xl shadow-slate-950/25">
        <div className="flex aspect-[16/11] items-center justify-center overflow-hidden rounded-[1.35rem] bg-white sm:aspect-[16/10]">
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-contain"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
              event.currentTarget.nextElementSibling.style.display = 'flex';
            }}
          />
          <div className="hidden h-full w-full flex-col items-center justify-center border border-dashed border-slate-300 bg-white p-6 text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Image missing</p>
            <p className="mt-3 max-w-sm text-sm font-bold leading-6 text-slate-700">{note}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureSection = ({ feature }) => {
  const Icon = feature.icon;

  return (
    <section id={feature.id} className="relative scroll-mt-32">
      <div className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${feature.reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{ backgroundColor: feature.accent }}
            >
              <Icon size={21} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.28em] text-slate-400">{feature.eyebrow}</span>
          </div>

          <div>
            <h2 className="text-3xl font-black leading-tight text-slate-950 sm:text-4xl">{feature.title}</h2>
            {feature.headline && (
              <h3 className="mt-4 text-xl font-extrabold leading-8" style={{ color: feature.accent }}>
                {feature.headline}
              </h3>
            )}
            <p className="mt-5 text-base font-medium leading-8 text-[#1D1D1B]">{feature.description}</p>
            {feature.detail && <p className="mt-4 text-base font-medium leading-8 text-[#1D1D1B]">{feature.detail}</p>}
          </div>

          {feature.points ? (
            <ul className="space-y-6">
              {feature.points.map((point) => (
                <li key={point.title} className="flex gap-4">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-950" />
                  <div>
                    <h3 className="text-lg font-extrabold leading-7 text-slate-950">{point.title}</h3>
                    <p className="mt-1 text-base font-normal leading-8 text-[#1D1D1B]">{point.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {feature.bullets.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 shrink-0" size={18} color={feature.accent} />
                  <span className="text-sm font-bold leading-6 text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <ImageSlot src={feature.imageSrc} alt={feature.imageAlt} note={feature.imageNote} accent={feature.accent} />
      </div>
    </section>
  );
};

const Features = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-950 antialiased selection:bg-[#FF6B00] selection:text-white">
      <PublicNavbar />

      <header className="relative overflow-hidden bg-[#111827] px-4 pb-20 pt-36 text-white sm:px-6 sm:pb-24 sm:pt-40 lg:pb-28">
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-blue-100">
              <Sparkles size={14} color={BRAND.orange} />
              Healthcare WhatsApp CRM Showcase
            </div>
            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.2rem]">
              <span className="text-[#FF6B00]">Advanced WhatsApp CRM Features</span>{' '}
              <span className="text-[#93C5FD]">Engineered for Healthcare Scaling</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-white sm:text-lg">
              A premium feature portal for clinic teams that need structured patient data, compliant staff operations, Meta API messaging control, and clear growth visibility from one secure command center.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {heroMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-2xl font-black text-white">{metric.value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{metric.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-6 py-4 text-sm font-black text-white shadow-xl shadow-orange-950/30 transition hover:bg-orange-600"
              >
                Start Clinic Setup <ArrowRight size={18} />
              </Link>
              <a
                href="#feature-matrix"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-black text-white transition hover:bg-white/10"
              >
                Explore Features
              </a>
            </div>
          </div>

          <ImageSlot src={heroImage.src} alt={heroImage.alt} note={heroImage.label} accent={BRAND.orange} />
        </div>
      </header>

      <main id="feature-matrix" className="bg-white px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-3xl">
            <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#2563EB]">
              Feature Matrix
            </span>
            <h2 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              Built as modular capability blocks for every clinic workflow.
            </h2>
            <p className="mt-5 text-base font-medium leading-8 text-slate-600">
              Put your downloaded screenshots inside public/assets/features using the file names shown in each image slot. The page will render those real images directly.
            </p>
          </div>

          <div className="space-y-24 sm:space-y-28">
            {featureBlocks.map((feature) => (
              <FeatureSection key={feature.id} feature={feature} />
            ))}
          </div>
        </div>
      </main>

    </div>
  );
};

export default Features;
