import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, Smartphone, MousePointer2, BarChart3, Mail, Users, 
  EyeOff, UserCog, ShieldAlert, Clock, Send, Menu, X, CheckCircle2, 
  Calculator, Play, Rocket, ChevronDown, ChevronUp, ArrowRight,
  FileText, QrCode, Settings, Facebook, Stethoscope, GraduationCap, Store,
  Star, ShieldCheck, Heart, Search, Sparkles, Filter, Copy, Layers, Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Footer from '../components/Footer';

// 🔒 STATIC HEALTHCARE RESOURCE LEDGER
const resourceLinks = [
  { name: "ROI Calculator", icon: <Calculator size={16}/>, link: "/calculator" },
  { name: "API Docs", icon: <FileText size={16}/>, link: "/docs" },
  { name: "QR Generator", icon: <QrCode size={16}/>, link: "/qr-generator" },
  { name: "Setup Docs", icon: <Settings size={16}/>, link: "/setup" },
];

const medicalServices = [
  { icon: <Smartphone />, title: "Live Preview Dashboard", desc: "Real-time preview on custom iPhone & Android nodes while creating clinical templates." },
  { icon: <MousePointer2 />, title: "Interactive CTA Buttons", desc: "Add single-tap Quick Reply & Call-to-Action nodes to maximize appointment conversion ratios." },
  { icon: <BarChart3 />, title: "Facebook Ads CRM Tracker", desc: "Track exactly which patient acquisition Facebook Ad campaign brought the clinical query to your WhatsApp API for hospitals." },
  { icon: <EyeOff />, title: "Ghost Mode Monitoring", desc: "Read medical patient queries quietly using secret spy features without triggering blue ticks." },
  { icon: <UserCog />, title: "Multi-Agent WhatsApp Inbox", desc: "Assign specialized doctors, receptionists, and clinical front-desk agents to patient threads instantly." },
  { icon: <ShieldAlert />, title: "WhatsApp API for Hospitals Safety", desc: "Smart infrastructure layers keeping your clinical medical account completely safe from meta restrictions." },
  { icon: <Clock />, title: "Auto-Shift Medical Timings", desc: "Automatically trigger customized 'Clinic is closed' messages post operational consultation hours." },
  { icon: <Send />, title: "Patient Appointment Automation", desc: "Send medical compliance reminders and health awareness camp messages to your central ledger in a single tap." },
];

const clinicTiers = [
    { 
        icon: <Stethoscope size={32} className="text-blue-600" />, 
        title: "Hospitals & Super-Specialty Centers", 
        points: ["Deploy WhatsApp API for hospitals", "Send patient appointment automation reminders", "Share diagnostic lab reports instantly"]
    },
    { 
        icon: <Heart size={32} className="text-[#FF6B00]" />, 
        title: "Private Medical Practice Management", 
        points: ["Follow up using automated patient communication system", "Trigger dental clinic management software macros", "Optimize clinic WhatsApp marketing tool pipelines"]
    },
    { 
        icon: <UserCog size={32} className="text-slate-900" />, 
        title: "Healthcare Front Desk Teams", 
        points: ["Coordinate multi-agent WhatsApp inbox threads", "Reduce receptionist workflow pressure", "Deploy best WhatsApp automation for doctors"]
    },
];

const templateCategories = [
  { id: 'dental', name: 'Dental Clinics' },
  { id: 'pediatric', name: 'Pediatric Care' },
  { id: 'general', name: 'General OPD' }
];

const mockTemplates = {
  dental: [
    { label: "Patient Appointment Automation", text: "Hello {{1}}, this is a reminder for your dental checkup with Dr. Sharma tomorrow at {{2}}. Reply 1 to Confirm.", type: "Utility Rate: ₹0.20" },
    { label: "Clinic WhatsApp Marketing Tool Campaign", text: "✨ Sparkling Smile Offer! Get 20% off on scaling & whitening this week at Shahi Clinic. Book slot now: {{1}}", type: "Marketing Rate: ₹0.90" }
  ],
  pediatric: [
    { label: "Automated Patient Communication System", text: "Dear Parent, your child {{1}} is due for their scheduled immunization dosage tomorrow at {{2}}. Please reach on time.", type: "Utility Rate: ₹0.20" },
    { label: "Patient Follow-Up Automation", text: "Hello {{1}}, hope your child is feeling better post medication. Please log current temperature intervals here: {{2}}", type: "Utility Rate: ₹0.20" }
  ],
  general: [
    { label: "Best WhatsApp Automation For Doctors", text: "Namaste {{1}}, your digital prescription history from Yogi Desk Medical Center has been generated securely. Click to view: {{2}}", type: "Utility Rate: ₹0.20" },
    { label: "Patient Engagement Software Notification", text: "🚨 Health Alert: Free Cardiac Consultation Camp this Sunday at Yogi Desk Hospital. Reply 'CAMP' to secure slot.", type: "Marketing Rate: ₹0.90" }
  ]
};

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResourceOpen, setIsResourceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dental');

  return (
    <div className="bg-white min-h-screen font-sans text-slate-900 selection:bg-[#FF6B00] selection:text-white antialiased">
      
      {/* ========================================================
          1. NAVIGATION BAR (RESPONSIVE ALL DEVICE MATRIX)
          ======================================================== */}
      <nav className="fixed w-full z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center shadow-lg shadow-orange-200 text-white font-extrabold text-xl">Y</div>
            <span className="text-xl font-black tracking-tight text-slate-900">Yogi Desk <span className="text-blue-600">AI</span></span>
          </div>

          <div className="hidden lg:flex gap-8 text-sm font-bold text-slate-600 items-center">
            <Link to="/" className="hover:text-[#FF6B00] transition">Home</Link>
            <Link to="/about" className="hover:text-[#FF6B00] transition">About Us</Link>
            <div className="relative group">
              <button className="flex items-center gap-1 hover:text-[#FF6B00] transition py-4" onMouseEnter={() => setIsResourceOpen(true)} onMouseLeave={() => setIsResourceOpen(false)}>
                Resources <ChevronDown size={14}/>
              </button>
              <div className={`absolute top-full left-0 w-56 bg-white border border-gray-100 shadow-xl rounded-xl p-2 transition-all duration-200 transform origin-top ${isResourceOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`} onMouseEnter={() => setIsResourceOpen(true)} onMouseLeave={() => setIsResourceOpen(false)}>
                 {resourceLinks.map((item, i) => (
                    <Link key={i} to={item.link} className="flex items-center gap-3 p-3 hover:bg-orange-50 rounded-lg text-slate-600 hover:text-[#FF6B00] transition">
                       {item.icon}<span className="font-semibold">{item.name}</span>
                    </Link>
                 ))}
              </div>
            </div>
            <Link to="/pricing" className="hover:text-[#FF6B00] transition">Pricing</Link>
            <Link to="/contact" className="hover:text-[#FF6B00] transition">Contact Us</Link>
          </div>

          <div className="hidden lg:flex gap-4 items-center">
             <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#FF6B00] transition">Log In</Link>
             <Link to="/signup" className="bg-[#FF6B00] hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-orange-200 flex items-center gap-2 transform hover:-translate-y-0.5">
                Get Started <ArrowRight size={16}/>
            </Link>
          </div>
          <button className="lg:hidden p-2 text-slate-900 hover:text-[#FF6B00]" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </div>

        {/* MOBILE SIDEBAR MENU CONTAINER */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="lg:hidden bg-white border-b border-gray-100 px-6 py-4 space-y-3 flex flex-col font-bold text-slate-600 text-sm">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00] py-2">Home</Link>
              <Link to="/pricing" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00] py-2">Pricing</Link>
              <Link to="/contact" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00] py-2">Contact Us</Link>
              <hr className="border-gray-100" />
              <Link to="/login" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00] py-2">Log In</Link>
              <Link to="/signup" onClick={() => setIsMenuOpen(false)} className="bg-[#FF6B00] text-white text-center py-3 rounded-xl shadow-md">Get Started</Link>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ========================================================
          2. HERO HERO HERO PANEL (₹50 CAP VALUE INJECTED)
          ======================================================== */}
      <header className="relative pt-36 sm:pt-44 pb-20 px-4 sm:px-6 overflow-hidden bg-gradient-to-b from-blue-50/50 via-white to-white">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 bg-white border border-blue-100 px-4 py-1.5 rounded-full text-xs font-black text-blue-700 mb-8 uppercase tracking-wider shadow-sm">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></span> Medical Compliance Secured
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-none mb-6 text-slate-900 tracking-tight">
              Airtight <span className="text-[#FF6B00]">WhatsApp CRM</span> <br className="hidden sm:block"/>
              Built For Dedicated Doctors
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-slate-500 mb-10 leading-relaxed max-w-3xl mx-auto font-medium">
              Deploy the official WhatsApp API for hospitals and clinics. Supercharge your operations using the ultimate clinic WhatsApp marketing tool designed to trigger seamless patient appointment automation without risk.
            </p>
            
            {/* VALUABLE ATTRACTION METRIC WRAPPER */}
            <div className="max-w-xl mx-auto bg-slate-900 text-white rounded-2xl p-4 sm:p-5 mb-10 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center gap-4 justify-between text-left">
              <div>
                <span className="text-xs font-black uppercase text-[#FF6B00] tracking-widest block mb-1">🎁 Instant Activation Gift</span>
                <p className="text-sm text-slate-300 font-medium">Get <strong className="text-white text-base font-black">₹50 Free Credits</strong> on signup immediately! Send up to <strong className="text-white underline">250 Appointment Reminders</strong> or <strong className="text-white underline">55 Marketing Messages</strong> 100% free.</p>
              </div>
              <Link to="/signup" className="w-full sm:w-auto shrink-0 bg-[#FF6B00] hover:bg-orange-600 px-5 py-3 rounded-xl text-center text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                Claim ₹50 <Sparkles size={14}/>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/signup" className="px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-orange-600 text-white text-base font-bold transition-all shadow-xl shadow-orange-200 flex items-center justify-center gap-2 transform hover:scale-105">
                Start Free Onboarding <Rocket size={18}/>
              </Link>
              <a href="#demo-section" className="px-8 py-4 rounded-xl border-2 border-slate-200 bg-white hover:border-blue-200 hover:text-blue-600 text-slate-600 text-base font-bold transition flex items-center justify-center gap-2">
                <Play size={16} className="fill-current text-blue-600"/> See Conversion Engine
              </a>
            </div>
          </motion.div>
        </div>
      </header>

      {/* MARQUEE */}
      <div className="py-8 border-y border-gray-100 bg-gray-50/50 overflow-hidden">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Trusted Across 500+ Medical Practice Management Networks In India</p>
            <div className="flex flex-wrap justify-center gap-6 sm:gap-12 opacity-40 grayscale font-black text-sm sm:text-base text-slate-800">
               <span>VITE MEDICAL CENTER</span>
               <span>SUPABASE HOSPITALS</span>
               <span>META OFFICIAL API</span>
               <span>CLINIC LEDGER NETWORKS</span>
            </div>
         </div>
      </div>

      {/* ========================================================
          3. REAL-TIME INTERACTIVE CONVERSION ENGINE ANIMATION
          ======================================================== */}
      <section id="demo-section" className="py-20 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
           <div className="text-center mb-12">
              <span className="text-blue-600 font-bold text-xs uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">Interactive Patient Journey</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3">Patient Ingestion Workflow Animation</h2>
              <p className="text-slate-500 mt-3 text-sm sm:text-base max-w-2xl mx-auto">Watch how an automated patient communication system seamlessly intercepts a patient thread to close slots instantly.</p>
           </div>
           <div className="flex justify-center"><ConversionDemo /></div>
        </div>
      </section>

      {/* ========================================================
          4. CORE UI MODULES REFACTORING (KEYWORDS EMBEDDED)
          ======================================================== */}
      <section className="py-20 bg-gray-50/50 overflow-hidden border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-24 sm:space-y-32">
              
              {/* MODULE 1: SHARED INBOX */}
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                  <div className="lg:w-1/2 space-y-5">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600"><MessageSquare size={24} /></div>
                      <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">One Shared Inbox.<br/>Zero Patient Chaos.</h2>
                      <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                          Stop misplacing clinical records across multiple staff phones. Yogi Desk provides a dedicated <strong className="text-slate-800">multi-agent WhatsApp inbox</strong> that lets your entire front desk access a single unified number. Doctors can review ongoing chats, receptionist agents can resolve queries, and data logs save securely onto your central workspace array.
                      </p>
                      <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                          This centralized platform acts as the prime <strong className="text-slate-800">clinic management software India</strong> demands, reducing patient drop-out ratios by up to 60%.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {['Multi-Agent Support', 'Instant Thread Mapping', 'Secure Chat Audits'].map(t=><span key={t} className="bg-white border border-gray-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">{t}</span>)}
                      </div>
                  </div>
                  
                  {/* INBOX LIVE DASHBOARD ACCURATE COMPONENT */}
                  <div className="w-full lg:w-1/2 relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-1000"></div>
                      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex h-[350px]">
                          <div className="w-16 bg-slate-900 flex flex-col items-center py-4 gap-4 shrink-0">
                              {['Dr', 'Rec', 'Ass', 'Adm'].map((i, k) => <div key={k} className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-black text-xs">{i}</div>)}
                          </div>
                          <div className="w-52 border-r border-gray-100 bg-white hidden sm:flex flex-col shrink-0">
                              <div className="p-4 border-b border-gray-100 font-black text-xs uppercase tracking-wider text-slate-400">Active Patient Leads</div>
                              <div className="divide-y divide-gray-50 flex-1 overflow-y-auto">
                                {[1,2,3].map(i => (
                                  <div key={i} className={`p-3 cursor-pointer transition ${i===1 ? 'bg-blue-50/50' : ''}`}>
                                     <div className="font-bold text-xs text-gray-800 flex justify-between items-center">Patient #{50+i} <span className="w-2 h-2 rounded-full bg-green-500"></span></div>
                                     <div className="text-[11px] text-gray-400 truncate mt-0.5">Automated patient communication loop...</div>
                                  </div>
                                ))}
                              </div>
                          </div>
                          <div className="flex-1 bg-slate-50 flex flex-col min-w-0">
                              <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center">
                                 <div>
                                   <span className="font-black text-sm text-gray-800 block leading-none">Amit Kumar</span>
                                   <span className="text-[10px] text-slate-400 font-mono mt-1 block">Assigned to Front Desk</span>
                                 </div>
                                 <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Patient Lead</span>
                              </div>
                              <div className="flex-1 p-4 space-y-3 flex flex-col justify-end">
                                 <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm text-xs text-gray-600 border border-gray-100 w-4/5">Hello, can I automate patient appointments on WhatsApp for Dr. Sharma's slot?</div>
                                 <div className="bg-blue-600 p-3 rounded-xl rounded-tr-none shadow-sm text-xs text-white ml-auto w-4/5">Yes Amit! Confirming your appointment slot securely via our patient engagement software system now.</div>
                              </div>
                              <div className="p-3 bg-white border-t border-gray-100 h-14 flex items-center"><div className="h-8 bg-gray-100 rounded-lg w-full"></div></div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* MODULE 2: GHOST MODE WITH PRIVATE NOTES */}
              <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16">
                  <div className="lg:w-1/2 space-y-5">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600"><EyeOff size={24} /></div>
                      <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">Supervise Conversations Safely With Ghost Mode &amp; Private Whispers</h2>
                      <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                          Yogi Desk provides the <strong className="text-slate-800">best WhatsApp automation for doctors</strong> who wish to maintain absolute control over patient satisfaction metrics. With **Ghost Mode**, senior doctors can read ongoing chat logs silently without triggering blue tracking ticks on the patient's device.
                      </p>
                      <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                          Need to guide your front desk agent? Use **Private Note Whispering** to drop internal, amber-colored contextual guidance tags directly inside the timeline. These tips are visible strictly to your logged-in clinic staff and are never dispatched to the patient's WhatsApp window.
                      </p>
                      <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 text-xs sm:text-sm text-purple-900 font-semibold">
                        💡 Perfect for audit quality tracking, onboarding new medical desk operators, and verifying diagnostic consultation parameters securely.
                      </div>
                  </div>
                  
                  {/* REAL GHOST MODE + PRIVATE NOTE MOCKUP */}
                  <div className="w-full lg:w-1/2 relative group">
                       <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-1000"></div>
                       <div className="relative rounded-2xl overflow-hidden shadow-xl border border-slate-800 bg-slate-950 h-[340px] flex flex-col">
                          <div className="bg-slate-900 p-4 flex justify-between items-center border-b border-slate-800">
                             <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div></div>
                             <div className="text-[10px] text-purple-400 font-black uppercase tracking-widest animate-pulse">🔒 GHOST MODE / PRIVATE NOTE ACTIVE</div>
                          </div>
                          <div className="flex-1 p-4 space-y-3 flex flex-col justify-end">
                             <div className="bg-slate-900 p-3 rounded-xl rounded-tl-none border border-slate-800 text-xs text-slate-300 w-3/4 opacity-60">Patient: What are the dental crowning charges?</div>
                             <div className="bg-slate-800 p-3 rounded-xl rounded-tr-none text-xs text-slate-300 ml-auto w-3/4 opacity-60">Staff: Let me verify our active slot catalog data...</div>
                             
                             {/* THE LIVE PRIVATE NOTE CARD INTERFACE */}
                             <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-200 font-medium w-full shadow-lg">
                               <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1">🔑 PRIVATE WHISPER (VISIBLE ONLY TO AGENTS):</div>
                               "Rahul, tell them the root canal pricing matrix starts from ₹2,500 under the Starter Clinic structure."
                             </div>
                          </div>
                       </div>
                  </div>
              </div>

              {/* MODULE 3: SMART CONTACT CRM */}
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
                  <div className="lg:w-1/2 space-y-5">
                      <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-[#FF6B00]"><Users size={24} /></div>
                      <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">Smart Patient CRM &amp; Dynamic Segmentation Tags</h2>
                      <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                          Convert random phone strings into an actionable <strong className="text-slate-800">WhatsApp CRM for doctors</strong>. Yogi Desk hosts a global ledger infrastructure that automatically cross-syncs consumer details whether they are added via a manual row adder, direct quick typing grids, or parsed via a multi-format file upload parser.
                      </p>
                      <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                          Filter and categorize patient rows based on custom clinical tags such as `#DentalCare`, `#OPDLead`, or `#FollowUpNeeded`. It serves as the ultimate <strong className="text-slate-800">medical practice management software</strong> tailored to keep your internal operation bounds clean and highly responsive.
                      </p>
                      <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="p-4 bg-white rounded-xl border border-gray-200">
                              <div className="text-2xl font-black text-slate-900 mb-0.5">Unlimited</div>
                              <div className="text-xs text-slate-500 font-bold uppercase tracking-wide">Patient Database Rows</div>
                          </div>
                          <div className="p-4 bg-white rounded-xl border border-gray-200">
                              <div className="text-2xl font-black text-[#FF6B00] mb-0.5">Lifetime</div>
                              <div className="text-xs text-slate-500 font-bold uppercase tracking-wide">Pricing Protection Metric</div>
                          </div>
                      </div>
                  </div>
                  
                  {/* CRM REAL DESIGN MATRIX COMPONENT */}
                  <div className="w-full lg:w-1/2 relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-red-400 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-1000"></div>
                      <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-white h-[320px] flex flex-col">
                          <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center text-white">
                             <div className="font-black text-xs uppercase tracking-wider flex gap-2 items-center"><Layers size={14} className="text-[#FF6B00]"/> Live Healthcare CRM Ingestion Ledger</div>
                             <div className="text-slate-400"><Search size={14}/></div>
                          </div>
                          <div className="divide-y divide-gray-100 overflow-y-auto flex-1 text-xs">
                             {[
                                {n: "Amit Kumar", t: "Patient Lead", c: "bg-green-100 text-green-700 border border-green-200"},
                                {n: "Sneha Roy", t: "Dental Follow-Up", c: "bg-blue-100 text-blue-700 border border-blue-200"},
                                {n: "Rajesh G.", t: "OPD Regular", c: "bg-orange-100 text-orange-700 border border-orange-200"},
                                {n: "Pooja Sharma", t: "VIP Consultation", c: "bg-purple-100 text-purple-700 border border-purple-200"},
                             ].map((c, i) => (
                                <div key={i} className="p-3.5 flex items-center justify-between hover:bg-gray-50/80 transition">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-700">{c.n[0]}</div>
                                      <div>
                                         <div className="font-bold text-gray-800">{c.n}</div>
                                         <div className="text-[10px] text-gray-400 font-mono mt-0.5">+91 98765 43210</div>
                                      </div>
                                   </div>
                                   <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wide ${c.c}`}>{c.t}</span>
                                </div>
                             ))}
                          </div>
                      </div>
                  </div>
              </div>

              {/* === NEW HIGH-VALUE SECTION: 200+ FREE TEMPLATE LIBRARY === */}
              <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16 pt-6">
                <div className="lg:w-1/2 space-y-5">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600"><FileText size={24} /></div>
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">Pre-Approved 200+ WhatsApp Template Library For Medical Specialties</h2>
                  <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                    Don't waste time drafting manual scripts or dealing with Meta rejection errors. Yogi Desk features a comprehensive internal <strong className="text-slate-800">healthcare marketing automation</strong> catalog housing over 200 pre-approved messaging node structures. 
                  </p>
                  <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                    Whether you require a highly secure validation structure for <strong className="text-slate-800">dental clinic management software</strong> setups, opd camp broadcasts, or routine child vaccine immunization text templates, we have ready templates optimized for instant dispatch.
                  </p>
                  
                  {/* SWITCH TABS */}
                  <div className="flex gap-2 bg-slate-100 p-1 rounded-xl max-w-sm">
                    {templateCategories.map(cat => (
                      <button key={cat.id} onClick={() => setActiveTab(cat.id)} className={`flex-1 text-center py-2 text-xs font-black rounded-lg uppercase tracking-wider transition-all ${activeTab === cat.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>
                        {cat.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* THE VISUAL SPECIFIED IN THE REQUIREMENT (IMAGE 1 STYLE) */}
                <div className="w-full lg:w-1/2 relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-1000"></div>
                  <div className="relative rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                      <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5"><Copy size={14}/> Specialty Copy Node Matrix</span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-emerald-100">Ready to Broadcast</span>
                    </div>
                    
                    <div className="space-y-3">
                      {mockTemplates[activeTab].map((tmpl, idx) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-orange-100 transition duration-300">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black text-slate-800">{tmpl.label}</span>
                            <span className="text-[10px] font-mono font-bold bg-white text-slate-600 px-2 py-0.5 rounded border border-gray-200">{tmpl.type}</span>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium bg-white p-2.5 rounded-lg border border-gray-100/60">"{tmpl.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* === NEW HIGH-VALUE SECTION: FACEBOOK ADS CRM LINK === */}
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16 pt-6">
                <div className="lg:w-1/2 space-y-5">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600"><Facebook size={24} /></div>
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">Direct Facebook Click-To-WhatsApp Ads CRM Framework</h2>
                  <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                    Stop burning marketing funds blindly on trace-less links. Yogi Desk provides an interactive injection interface acting as a core <strong className="text-slate-800">clinic WhatsApp marketing tool</strong> that tracks incoming paid patient streams perfectly.
                  </p>
                  <p className="text-sm sm:text-base text-slate-500 leading-relaxed">
                    When a patient interacts with your promotional healthcare ads on Facebook or Instagram, Yogi Desk maps their incoming session tracking codes. You can analyze exactly which medical service ad asset yielded the conversion right inside your <strong className="text-slate-800">healthcare WhatsApp automation</strong> dashboard logs.
                  </p>
                  <div className="bg-slate-900 text-slate-300 p-4 rounded-xl border border-slate-800 text-xs sm:text-sm font-medium">
                    🔥 <strong className="text-white">Patient Growth Formula:</strong> By tracing ad identifiers directly, you can scale high-converting healthcare banners and shut down unprofitable leaks immediately.
                  </div>
                </div>

                {/* ADS LINK VISUAL MOCKUP */}
                <div className="w-full lg:w-1/2 relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl blur opacity-15 group-hover:opacity-25 transition duration-1000"></div>
                  <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200 bg-white h-[320px] flex flex-col">
                    <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-gray-700 flex items-center gap-1.5"><BarChart3 size={14} className="text-indigo-600"/> Paid Acquisition Campaign Tracker</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping"></span>
                    </div>
                    <div className="p-4 space-y-3 flex-1 overflow-y-auto text-xs font-medium">
                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-800">Campaign: "Dental Whitening Noida Camp"</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ad Asset ID: meta_9983_df</p>
                        </div>
                        <span className="bg-indigo-600 text-white font-black px-2 py-1 rounded text-[10px]">142 Patient Leads</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center opacity-70">
                        <div>
                          <p className="font-bold text-slate-700">Campaign: "Pediatric Vaccination Drive"</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ad Asset ID: meta_1102_bz</p>
                        </div>
                        <span className="bg-slate-700 text-white font-black px-2 py-1 rounded text-[10px]">89 Patient Leads</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center opacity-70">
                        <div>
                          <p className="font-bold text-slate-700">Campaign: "Full Body Checkup Hospital Ad"</p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">Ad Asset ID: meta_3345_qw</p>
                        </div>
                        <span className="bg-slate-700 text-white font-black px-2 py-1 rounded text-[10px]">64 Patient Leads</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

          </div>
      </section>

      {/* ========================================================
          5. DYNAMIC STATS COUNTER GRID BLOCK
          ======================================================== */}
      <section className="py-16 bg-[#FF6B00] text-white">
         <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
               { label: "Patient Reminders Sent", val: "10M+" },
               { label: "Active Clinic Workspaces", val: "500+" },
               { label: "Automated Patient Leads", val: "1.2M+" },
               { label: "Core Web API Uptime", val: "99.9%" }
            ].map((stat, i) => (
               <div key={i}>
                  <div className="text-3xl sm:text-5xl font-black mb-1.5">{stat.val}</div>
                  <div className="text-orange-100 font-bold text-xs sm:text-sm uppercase tracking-wide">{stat.label}</div>
               </div>
            ))}
         </div>
      </section>

      {/* ========================================================
          6. INDUSTRIES SECTOR GRID (HEALTHCARE TARGET ONLY)
          ======================================================== */}
      <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-16">
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">Engineered Specially For Healthcare Environments</h2>
                  <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto">Yogi Desk eliminates administrative friction from medical operations. Boost your active patient acquisition rates instantly.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {clinicTiers.map((item, i) => (
                      <div key={i} className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-200 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                          <div className="mb-5 bg-slate-50 w-14 h-14 rounded-xl flex items-center justify-center">{item.icon}</div>
                          <h3 className="text-xl font-black text-slate-900 mb-3 leading-tight">{item.title}</h3>
                          <ul className="space-y-2.5">
                              {item.points.map((pt, k) => <li key={k} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-600 font-medium"><CheckCircle2 size={18} className="text-[#FF6B00] shrink-0 mt-0.5"/><span>{pt}</span></li>)}
                          </ul>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* ========================================================
          7. ALL FEATURES OVERVIEW MATRIX GRID BLOCK
          ======================================================== */}
      <section id="features" className="py-20 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black mb-3 text-slate-900">Comprehensive Healthcare Automation Ledger</h2>
            <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto">Everything you need to activate premium patient engagement software parameters and scale clinical workflows securely.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {medicalServices.map((service, index) => (
              <div key={index} className="bg-white p-6 sm:p-7 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-default">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-[#FF6B00] transition-colors duration-300">
                  <div className="text-[#FF6B00] group-hover:text-white transition-colors duration-300">{service.icon}</div>
                </div>
                <h3 className="text-base sm:text-lg font-black mb-2 text-slate-900 leading-tight">{service.title}</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed font-medium">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          8. FINAL CTA ROW INJECTION
          ======================================================== */}
      <section className="py-20 bg-slate-900 text-white text-center relative overflow-hidden">
         <div className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10">
            <h2 className="text-3xl sm:text-5xl font-black mb-4">Ready to Automate Your Clinic's Ingestion Flow?</h2>
            <p className="text-sm sm:text-lg text-slate-400 mb-8 max-w-xl mx-auto">Join hundreds of medical practitioners maximizing patient retention using Yogi Desk. Claim your ₹50 credit backup now.</p>
            <Link to="/signup" className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-orange-600 text-white px-8 py-4 rounded-xl text-base font-bold transition shadow-2xl shadow-orange-500/20 transform hover:scale-105">
               Activate Account With ₹50 Free Credits <Rocket size={18}/>
            </Link>
         </div>
      </section>

      {/* FOOTER CONTAINER */}
      <Footer />
    </div>
  );
};

// ========================================================
// SUB-COMPONENT: ANIMATED DEMO CORE ENGINE (IMAGE 2 DESIGN MATCH)
// ========================================================
const ConversionDemo = () => {
  const [stage, setStage] = useState('ad');
  const [chatStep, setChatStep] = useState(0);

  useEffect(() => {
    let timer;
    if (stage === 'chat') {
       if (chatStep < 4) timer = setTimeout(() => setChatStep(prev => prev + 1), 1600);
    }
    return () => clearTimeout(timer);
  }, [stage, chatStep]);

  const restart = () => { setStage('ad'); setChatStep(0); };

  return (
     <div className="relative w-full max-w-4xl mx-auto h-[480px] bg-white rounded-3xl shadow-xl overflow-hidden border-8 border-slate-900 flex flex-col sm:flex-row">
        
        {/* Left Indicator Tracker */}
        <div className="hidden sm:flex w-1/3 bg-slate-950 text-white p-6 flex-col justify-center border-r border-slate-800">
           <div className="space-y-6">
              <div className={`transition-all duration-500 ${stage === 'ad' ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
                 <div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 bg-blue-600 rounded-md"><Facebook size={16}/></div><h3 className="font-bold text-xs uppercase tracking-wider text-[#FF6B00]">1. Patient Ad Click</h3></div>
                 <p className="text-xs text-slate-400 font-medium">User interacts with your Facebook Healthcare Ad.</p>
              </div>
              <div className={`transition-all duration-500 ${stage === 'chat' ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
                 <div className="flex items-center gap-2 mb-1.5"><div className="p-1.5 bg-green-500 rounded-md"><MessageSquare size={16}/></div><h3 className="font-bold text-xs uppercase tracking-wider text-[#FF6B00]">2. Automated Dialogue</h3></div>
                 <p className="text-xs text-slate-400 font-medium">The automated patient communication system parses options instantly.</p>
              </div>
              <button onClick={restart} className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-[#FF6B00] flex items-center gap-1.5 pt-4 transition"><Play size={10} className="fill-current"/> Replay Simulation</button>
           </div>
        </div>
        
        {/* Main Phone Sandbox Panel */}
        <div className="w-full sm:w-2/3 bg-gray-100 relative min-h-0 flex-1">
           <AnimatePresence>
             {stage === 'ad' && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white flex flex-col items-center justify-center p-4">
                  <div className="w-full max-w-sm bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden text-xs">
                     <div className="p-3 flex items-center gap-2.5 border-b border-gray-100"><div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center font-black text-blue-600">M</div><div><div className="font-bold text-slate-800 text-xs">Shahi Medical &amp; Dental Center</div><div className="text-[9px] text-slate-400">Sponsored • 🌍</div></div></div>
                     <div className="h-32 bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center text-center p-4"><span className="text-4xl animate-bounce">🦷🩺</span></div>
                     <div className="p-4 bg-slate-50"><h4 className="font-bold text-slate-900 text-sm">Free Dental &amp; Health Consultation Camp!</h4><p className="text-[11px] text-slate-500 mt-1 font-medium">Claim your free OPD slot safely. Slots vanishing rapidly under the Starter tier.</p><button onClick={() => setStage('chat')} className="mt-4 w-full bg-[#25D366] hover:bg-[#1da851] text-white py-2.5 rounded-lg font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-sm transition-all"><MessageSquare size={16}/> Instant WhatsApp Booking</button></div>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
           
           <AnimatePresence>
             {stage === 'chat' && (
               <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 24 }} className="absolute inset-0 bg-[#E5DDD5] flex flex-col">
                  <div className="bg-[#075E54] h-16 flex items-center px-4 text-white shadow-md z-10 shrink-0"><ArrowRight onClick={restart} className="mr-2 rotate-180 cursor-pointer text-slate-300"/><div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#075E54] font-black mr-2">S</div><div><div className="font-bold text-sm">Shahi Medical Center</div><div className="text-[10px] opacity-80">Official WhatsApp Business API Account</div></div></div>
                  
                  <div className="flex-1 p-4 space-y-3.5 overflow-y-auto flex flex-col justify-start text-xs font-medium">
                     {chatStep >= 1 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-end ml-auto bg-[#DCF8C6] p-3 rounded-xl rounded-tr-none shadow-sm max-w-[80%] text-slate-900">Hi, I want to confirm my slot for the Free Medical Camp.<div className="text-[9px] text-slate-500 text-right mt-1 font-mono">10:00 AM ✓✓</div></motion.div>}
                     {chatStep >= 2 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-start mr-auto bg-white p-3 rounded-xl rounded-tl-none shadow-sm max-w-[80%] text-slate-900">Namaste! 👋 Welcome to **Shahi Medical Center**.<br/><br/>Your profile has been ingested into our ledger. Please pick your care timing slot node option below:<div className="text-[9px] text-slate-400 text-right mt-1 font-mono">10:00 AM</div></motion.div>}
                     
                     {/* SPECIFIED ACCURATE WATI ANIMATION SIMULATION GRID (IMAGE 2 MATCH) */}
                     {chatStep >= 3 && (
                       <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-1.5 max-w-[75%] mr-auto self-start w-full">
                         {['Tomorrow 11:30 AM', 'Tomorrow 04:15 PM', 'Cancel Custom Setup'].map((btn, bIdx) => (
                           <button key={bIdx} onClick={() => bIdx === 0 && setChatStep(4)} className="w-full bg-white text-blue-600 hover:bg-blue-50 border border-gray-200 py-2 rounded-xl text-center font-bold text-[11px] shadow-sm transition block truncate">
                             {btn}
                           </button>
                         ))}
                       </motion.div>
                     )}
                     
                     {chatStep >= 4 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-start mr-auto bg-white p-3 rounded-xl rounded-tl-none shadow-sm max-w-[80%] text-slate-900">✅ <strong className="text-emerald-700">Appointment Confirmed!</strong><br/>Your slot is locked for tomorrow at **11:30 AM**.<br/><br/>📍 Address: Sector 4, Patna. Reminders track linked.<div className="text-[9px] text-slate-400 text-right mt-1 font-mono">10:01 AM</div></motion.div>}
                  </div>
                  
                  <div className="h-14 bg-[#f0f0f0] flex items-center px-3 gap-2 shrink-0"><div className="w-6 h-6 rounded-full bg-slate-300"></div><div className="flex-1 h-8 bg-white rounded-lg"></div><div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center text-white"><Send size={14}/></div></div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
     </div>
  );
};

export default LandingPage;