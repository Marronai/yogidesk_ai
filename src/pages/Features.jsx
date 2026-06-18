import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  LockKeyhole,
  MessageSquareText,
  MonitorCheck,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
  UserCog,
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

const featureBlocks = [
  {
    id: 'staff-setup',
    eyebrow: 'Feature 01',
    title: 'Empower Your Clinic Team with Smart Staff Setup & Multi-Agent Communication',
    description:
      "Streamline your medical workspace operations using YogiDesk's advanced clinic team setup panel. This feature allows doctors and practice administrators to seamlessly onboard healthcare staff, receptionists, and nursing team members onto a unified platform. Once added, your designated team can log in independently to trigger pre-approved WhatsApp message templates, automate patient updates, and handle daily practice inquiries efficiently.",
    detail:
      'To maintain strict compliance and clinical security, YogiDesk provides robust role-based access control (RBAC). As the super-admin, the doctor can precisely decide and assign exact operational permissions for each receptionist or staff member. Furthermore, the master dashboard offers comprehensive real-time team chat monitoring, allowing the admin doctor to audit all patient communication, view active chat logs in flight, and maintain total quality control over the clinic digital interactions from a single secure console.',
    imageSrc: '',
    imageAlt: 'Staff setup and multi-agent communication dashboard',
    imageNote: 'Add your staff setup dashboard image here by filling imageSrc for staff-setup.',
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
      "Eliminate tedious manual record-keeping with YogiDesk's frictionless patient data adder framework, designed to build a structured, actionable healthcare contact database. Doctors, receptionists, and practice managers can ingest patient details into the system using multiple flexible channels. For instant entries between consultations, the quick adder tool allows immediate input, while the robust bulk-upload engine supports native medical CSV and Excel (.xlsx) data sheet imports to migrate thousands of patient profiles effortlessly.",
    detail:
      'Once processed, the records populate cleanly into a dynamic, filterable electronic patient directory displayed directly on the screen. This centralized data matrix serves as the launchpad for your entire WhatsApp patient communication strategy. Your authorized clinic team can utilize this verified database to instantly deploy operational notification templates, broadcast automation flows, and critical medical alerts, ensuring a personalized and responsive healthcare experience for every patient.',
    imageSrc: '',
    imageAlt: 'Patient data ingestion and contact directory dashboard',
    imageNote: 'Add your patient directory or upload dashboard image here by filling imageSrc for patient-directory.',
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
    description:
      'INSERT DESCRIPTION PARAGRAPH HERE for automated clinic broadcast streams, patient recall reminders, follow-up journeys, and approved Meta template delivery across verified healthcare contact cohorts.',
    detail:
      'INSERT SUPPORTING DETAIL PARAGRAPH HERE explaining segmentation, scheduling, campaign safety, delivery feedback loops, and operational value for clinic management workflows.',
    imageSrc: '',
    imageAlt: 'Automated WhatsApp broadcast stream dashboard',
    imageNote: 'Add your broadcast automation image here by filling imageSrc for broadcast-streams.',
    icon: MessageSquareText,
    accent: BRAND.orange,
    reverse: false,
    bullets: [
      'INSERT METRIC BULLET HERE',
      'INSERT TEMPLATE CATEGORY BULLET HERE',
      'INSERT DELIVERY CONTROL BULLET HERE',
      'INSERT CLINIC OUTCOME BULLET HERE',
    ],
    metrics: ['Templates', 'Segments', 'Delivery'],
  },
  {
    id: 'ai-balance',
    eyebrow: 'Feature 04',
    title: 'Live AI Balance Tracking Loops with Usage Transparency',
    description:
      'INSERT DESCRIPTION PARAGRAPH HERE for live AI balance visibility, credit movement tracking, and usage intelligence across patient support, broadcasts, and automated response workflows.',
    detail:
      'INSERT SUPPORTING DETAIL PARAGRAPH HERE explaining how doctors can inspect wallet health, recharge readiness, consumption patterns, and team-level automation accountability.',
    imageSrc: '',
    imageAlt: 'AI balance and usage tracking dashboard',
    imageNote: 'Add your AI balance tracking image here by filling imageSrc for ai-balance.',
    icon: BarChart3,
    accent: BRAND.blue,
    reverse: true,
    bullets: [
      'INSERT BALANCE MONITORING BULLET HERE',
      'INSERT RECHARGE ALERT BULLET HERE',
      'INSERT STAFF USAGE BULLET HERE',
      'INSERT REPORTING BULLET HERE',
    ],
    metrics: ['Credits', 'Usage', 'Reports'],
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

const DashboardPlaceholder = ({ feature }) => {
  const Icon = feature.icon;

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <ImageDepth accent={feature.accent} />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/15 bg-white shadow-2xl shadow-slate-950/30">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Image Slot
          </span>
        </div>

        <div className="relative min-h-[320px] bg-slate-50 p-4 sm:min-h-[390px] sm:p-6">
          {feature.imageSrc ? (
            <img
              src={feature.imageSrc}
              alt={feature.imageAlt}
              className="h-full min-h-[280px] w-full rounded-2xl object-cover shadow-inner"
            />
          ) : (
            <div className="flex min-h-[280px] flex-col justify-between rounded-2xl border border-dashed border-slate-300 bg-white p-5 sm:min-h-[335px]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
                    style={{ backgroundColor: feature.accent }}
                  >
                    <Icon size={24} />
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">
                    Add image path in Features.jsx
                  </p>
                  <h3 className="mt-3 max-w-sm text-xl font-black leading-tight text-slate-950">
                    {feature.imageAlt}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm font-medium leading-6 text-slate-500">
                    {feature.imageNote}
                  </p>
                </div>
                <MonitorCheck className="hidden text-slate-300 sm:block" size={34} />
              </div>

              <div className="mt-8 grid grid-cols-3 gap-3">
                {feature.metrics.map((metric) => (
                  <div key={metric} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="h-1.5 w-10 rounded-full" style={{ backgroundColor: feature.accent }} />
                    <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-slate-600">{metric}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            <p className="mt-5 text-base font-medium leading-8 text-slate-600">{feature.description}</p>
            <p className="mt-4 text-base font-medium leading-8 text-slate-600">{feature.detail}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {feature.bullets.map((item) => (
              <div key={item} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} color={feature.accent} />
                <span className="text-sm font-bold leading-6 text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <DashboardPlaceholder feature={feature} />
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
            <h1 className="text-4xl font-black leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              Advanced WhatsApp CRM Features Engineered for Healthcare Scaling
            </h1>
            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-slate-300 sm:text-lg">
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

          <div className="relative">
            <ImageDepth accent={BRAND.orange} />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white p-4 shadow-2xl shadow-black/30 sm:p-5">
              <div className="rounded-[1.5rem] bg-slate-50 p-4 sm:p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Dashboard Wireframe</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">Clinic Command Center</h2>
                  </div>
                  <div className="rounded-2xl bg-[#2563EB] p-3 text-white">
                    <Stethoscope size={22} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    {[UserCog, ShieldCheck, UploadCloud].map((Icon, index) => (
                      <div key={index} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                        <Icon size={20} color={index === 1 ? BRAND.orange : BRAND.blue} />
                        <div className="mt-4 h-2 w-20 rounded-full bg-slate-200" />
                        <div className="mt-2 h-2 w-28 rounded-full bg-slate-100" />
                      </div>
                    ))}
                  </div>
                  <div className="rounded-3xl bg-[#111827] p-4 text-white">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Live Care Thread</span>
                      <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-black text-emerald-300">Active</span>
                    </div>
                    <div className="space-y-3">
                      <div className="mr-8 rounded-2xl rounded-tl-sm bg-white/10 p-3 text-xs font-semibold leading-5 text-slate-200">
                        Patient imported from OPD sheet. Reminder template ready.
                      </div>
                      <div className="ml-8 rounded-2xl rounded-tr-sm bg-[#2563EB] p-3 text-xs font-semibold leading-5 text-white">
                        Staff can send after doctor approval.
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center gap-3">
                          <Activity size={18} color={BRAND.orange} />
                          <div className="h-2 flex-1 rounded-full bg-white/10">
                            <div className="h-2 w-2/3 rounded-full bg-[#FF6B00]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Hero image location</p>
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    Replace this mockup in <span className="text-slate-950">src/pages/Features.jsx</span> hero right column when your premium dashboard illustration is ready.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="feature-matrix" className="bg-slate-50 px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-3xl">
            <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[#2563EB]">
              Feature Matrix
            </span>
            <h2 className="mt-5 text-3xl font-black leading-tight text-slate-950 sm:text-5xl">
              Built as modular capability blocks for every clinic workflow.
            </h2>
            <p className="mt-5 text-base font-medium leading-8 text-slate-600">
              Use the `imageSrc` fields inside each feature object to add final screenshots. Until then, the page renders polished dashboard placeholders that keep the layout production-ready.
            </p>
          </div>

          <div className="space-y-24 sm:space-y-28">
            {featureBlocks.map((feature) => (
              <FeatureSection key={feature.id} feature={feature} />
            ))}
          </div>
        </div>
      </main>

      <section className="bg-[#111827] px-4 py-16 text-white sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#FF6B00]">Ready for production copy</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">
              Add your screenshots, refine the placeholder blocks, and launch the Features showcase.
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: FileSpreadsheet, label: 'Imports' },
              { icon: LockKeyhole, label: 'Security' },
              { icon: CheckCircle2, label: 'Templates' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <Icon className="mx-auto" size={22} color={BRAND.orange} />
                <p className="mt-2 text-xs font-black uppercase tracking-wider text-slate-300">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Features;
