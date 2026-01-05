import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, Smartphone, MousePointer2, BarChart3, Mail, Users, 
  EyeOff, UserCog, ShieldAlert, Clock, Send, Menu, X, CheckCircle2, 
  Calculator, Play, Rocket, ChevronDown, ChevronUp, ArrowRight,
  FileText, QrCode, Settings, Facebook, Stethoscope, GraduationCap, Store,
  Star, Globe, ShieldCheck, Heart, Search // ✅ Search Imported
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// 🔒 SECURITY & PERFORMANCE PATCH: 
// Static Data ko component ke bahar rakha hai taaki har render par memory waste na ho.
// Isse site fast load hogi aur browser freeze nahi hoga (Anti-DoS Best Practice).

const resourceLinks = [
  { name: "ROI Calculator", icon: <Calculator size={16}/>, link: "/calculator" },
  { name: "API Docs", icon: <FileText size={16}/>, link: "/docs" },
  { name: "QR Generator", icon: <QrCode size={16}/>, link: "/qr-generator" },
  { name: "Setup Docs", icon: <Settings size={16}/>, link: "/setup" },
];

const services = [
  { icon: <Smartphone />, title: "Live Preview", desc: "Real-time preview on iPhone & Android while creating templates." },
  { icon: <MousePointer2 />, title: "Interactive Buttons", desc: "Add Quick Reply & Call-to-Action buttons to boost replies." },
  { icon: <BarChart3 />, title: "Ads Tracker", desc: "Track exactly which Facebook Ad brought the customer to WhatsApp." },
  { icon: <EyeOff />, title: "Ghost Mode", desc: "Read customer messages secretly without triggering blue ticks." },
  { icon: <UserCog />, title: "Team Management", desc: "Assign multiple agents to handle customer queries efficiently." },
  { icon: <ShieldAlert />, title: "Spam Protection", desc: "Smart filters to keep your number safe from getting banned." },
  { icon: <Clock />, title: "Auto-Shift Timing", desc: "Automatically send 'We are closed' messages after office hours." },
  { icon: <Send />, title: "Bulk Broadcasting", desc: "Send offers to 10,000+ customers in a single click safely." },
];

const industries = [
    { 
        icon: <Stethoscope size={32} className="text-blue-500" />, 
        title: "For Hospitals & Clinics", 
        points: ["Auto-Book Appointments 24/7", "Send Appointment Reminders", "Share Lab Reports Automatically"]
    },
    { 
        icon: <Store size={32} className="text-orange-500" />, 
        title: "For E-Commerce & Retail", 
        points: ["Recover Abandoned Carts", "Send Order Updates & Tracking", "Broadcast Festival Offers"]
    },
    { 
        icon: <GraduationCap size={32} className="text-green-500" />, 
        title: "For Education & EdTech", 
        points: ["Automate Student Admissions", "Send Fee Reminders", "Share Class Schedules Instantly"]
    },
];

const testimonials = [
  { name: "Dr. Sharma", role: "Dental Surgeon", text: "Marroncorp reduced our no-show rate by 40% with automated reminders.", rating: 5 },
  { name: "Rahul Verma", role: "E-com Owner", text: "The best WhatsApp tool for Shopify. ROI is insane!", rating: 5 },
  { name: "Priya Singh", role: "EdTech Founder", text: "Managing student queries was a nightmare, now it's automated.", rating: 5 },
];

const faqs = [
  { q: "Is this compliant with WhatsApp Policy?", a: "Yes, Marroncorp is built on the Official WhatsApp Business API, ensuring 100% compliance." },
  { q: "Can I use my existing number?", a: "Yes, you can migrate your existing WhatsApp number to our platform in 10 minutes." },
  { q: "What is the Free Checkup Ad feature?", a: "It's a feature where leads from Facebook Ads land directly in your WhatsApp with a pre-filled message." },
];

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isResourceOpen, setIsResourceOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="bg-white min-h-screen font-sans text-slate-900 selection:bg-[#FF6B00] selection:text-white">
      
      {/* 1. NAVBAR */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center shadow-lg shadow-orange-200 text-white font-bold text-xl">M</div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Marroncorp</span>
          </div>

          <div className="hidden md:flex gap-8 text-sm font-bold text-slate-600 items-center">
            <Link to="/" className="hover:text-[#FF6B00] transition">Home</Link>
            <Link to="/about" className="hover:text-[#FF6B00] transition">About Us</Link>
            <div className="relative group">
              <button className="flex items-center gap-1 hover:text-[#FF6B00] transition py-4" onMouseEnter={() => setIsResourceOpen(true)} onMouseLeave={() => setIsResourceOpen(false)}>
                Resources <ChevronDown size={14}/>
              </button>
              {/* Dropdown Menu */}
              <div className={`absolute top-full left-0 w-56 bg-white border border-gray-100 shadow-xl rounded-xl p-2 transition-all duration-200 transform origin-top ${isResourceOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`} onMouseEnter={() => setIsResourceOpen(true)} onMouseLeave={() => setIsResourceOpen(false)}>
                 {resourceLinks.map((item, i) => (
                    <Link key={i} to={item.link} className="flex items-center gap-3 p-3 hover:bg-orange-50 rounded-lg text-slate-600 hover:text-[#FF6B00] transition">
                       {item.icon}<span>{item.name}</span>
                    </Link>
                 ))}
              </div>
            </div>
            <Link to="/pricing" className="hover:text-[#FF6B00] transition">Pricing</Link>
            <Link to="/contact" className="hover:text-[#FF6B00] transition">Contact Us</Link>
          </div>

          <div className="hidden md:flex gap-4 items-center">
             <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#FF6B00] transition">Log In</Link>
             <Link to="/signup" className="bg-[#FF6B00] hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition shadow-lg shadow-orange-200 flex items-center gap-2 transform hover:-translate-y-0.5">
               Get Started <ArrowRight size={16}/>
            </Link>
          </div>
          <button className="md:hidden text-slate-900" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X /> : <Menu />}</button>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <header className="relative pt-40 pb-20 px-6 overflow-hidden bg-gradient-to-b from-orange-50 via-white to-white">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 bg-white border border-orange-100 px-4 py-1.5 rounded-full text-xs font-bold text-[#FF6B00] mb-8 uppercase tracking-wider shadow-sm">
              <span className="w-2 h-2 bg-[#FF6B00] rounded-full animate-ping"></span> #1 WhatsApp Marketing Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 text-slate-900 tracking-tight">
              Scale Your Business on <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-500">WhatsApp API</span>
            </h1>
            <p className="text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto">
              The complete automation suite for <b>Hospitals, EdTech, Retail & MSMEs</b>. Broadcast offers, automate support, and track every lead—<b>without getting blocked</b>.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-5">
              <Link to="/signup" className="px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-orange-600 text-white text-lg font-bold transition-all shadow-xl shadow-orange-200 flex items-center justify-center gap-2 transform hover:scale-105">
                Start Free Trial <Rocket size={20}/>
              </Link>
              <a href="#demo-section" className="px-8 py-4 rounded-xl border-2 border-slate-100 bg-white hover:border-orange-100 hover:text-[#FF6B00] text-slate-600 text-lg font-bold transition flex items-center justify-center gap-2">
                <Play size={20} className="fill-current"/> See How It Works
              </a>
            </div>
          </motion.div>
        </div>
      </header>

      {/* 2.5 TRUSTED BY (MARQUEE) */}
      <div className="py-10 border-y border-gray-100 bg-gray-50/50">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Trusted by 500+ Businesses</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
               <span className="text-xl font-black text-slate-800">Shopify</span>
               <span className="text-xl font-black text-slate-800">WooCommerce</span>
               <span className="text-xl font-black text-slate-800">Zapier</span>
               <span className="text-xl font-black text-slate-800">Meta</span>
               <span className="text-xl font-black text-slate-800">HubSpot</span>
            </div>
         </div>
      </div>

      {/* 3. DEMO SECTION */}
      <section id="demo-section" className="py-24 bg-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
           <div className="text-center mb-16">
              <span className="text-[#FF6B00] font-bold text-sm uppercase tracking-widest">Live Experience</span>
              <h2 className="text-4xl font-bold text-slate-900 mt-2">See The Magic Happen</h2>
              <p className="text-slate-500 mt-4 max-w-2xl mx-auto">Watch how a user sees your Ad on Facebook and instantly books an appointment on WhatsApp.</p>
           </div>
           <div className="flex justify-center"><ConversionDemo /></div>
        </div>
      </section>

      {/* 4. VISUAL FEATURES DEEP DIVE (CODE MOCKUPS) */}
      <section className="py-24 bg-gray-50 overflow-hidden border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-6 space-y-32">
              
              {/* === FEATURE 1: SHARED INBOX === */}
              <div className="flex flex-col md:flex-row items-center gap-16">
                  <div className="md:w-1/2 space-y-6">
                      <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600"><MessageSquare size={28} /></div>
                      <h2 className="text-4xl font-bold text-slate-900 leading-tight">One Shared Inbox.<br/>Zero Chaos.</h2>
                      <p className="text-lg text-slate-500 leading-relaxed">
                          No more switching phones. Access the same WhatsApp number on multiple devices. 
                          Assign chats to agents, add internal notes, and tag customers instantly.
                      </p>
                      <ul className="space-y-4 pt-4">
                          {['Multi-Agent Login', 'Chat Assignment', 'Internal Notes'].map(item => <li key={item} className="flex items-center gap-3 text-slate-700 font-bold"><CheckCircle2 className="text-blue-500 shrink-0" size={20} /> {item}</li>)}
                      </ul>
                  </div>
                  
                  {/* INBOX MOCKUP */}
                  <div className="md:w-1/2 relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex h-[350px]">
                          {/* Sidebar */}
                          <div className="w-20 bg-gray-50 border-r border-gray-100 flex flex-col items-center py-4 gap-4">
                              {[1,2,3,4].map(i => <div key={i} className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">U{i}</div>)}
                          </div>
                          {/* Chat List */}
                          <div className="w-64 border-r border-gray-100 bg-white hidden sm:block">
                              <div className="p-4 border-b border-gray-100 font-bold text-gray-700">Chats</div>
                              {[1,2,3].map(i => (
                                <div key={i} className="p-4 border-b border-gray-50 hover:bg-blue-50 cursor-pointer transition">
                                   <div className="font-bold text-sm text-gray-800">Patient #{100+i}</div>
                                   <div className="text-xs text-gray-400 truncate">Is the report ready?</div>
                                </div>
                              ))}
                          </div>
                          {/* Chat Area */}
                          <div className="flex-1 bg-slate-50 flex flex-col">
                              <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center">
                                 <span className="font-bold text-gray-800">Rahul Verma</span>
                                 <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">Active</span>
                              </div>
                              <div className="flex-1 p-4 space-y-3 overflow-hidden">
                                 <div className="self-start bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-sm text-gray-600 border border-gray-100 w-3/4">Hi, I need to reschedule my appointment.</div>
                                 <div className="self-end bg-blue-600 p-3 rounded-2xl rounded-tr-none shadow-md text-sm text-white ml-auto w-3/4">Sure Rahul, how about tomorrow at 4 PM?</div>
                              </div>
                              <div className="p-3 bg-white border-t border-gray-100">
                                 <div className="h-10 bg-gray-100 rounded-full w-full"></div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* === FEATURE 2: GHOST MODE (Reversed) === */}
              <div className="flex flex-col md:flex-row-reverse items-center gap-16">
                  <div className="md:w-1/2 space-y-6">
                      <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600"><EyeOff size={28} /></div>
                      <h2 className="text-4xl font-bold text-slate-900 leading-tight">Supervise with<br/>Ghost Mode 👻</h2>
                      <p className="text-lg text-slate-500 leading-relaxed">
                          Keep an eye on your support team without alerting the customer. Read messages silently. Blue ticks won't appear until you want them to.
                      </p>
                      <ul className="space-y-4 pt-4">
                          {['Silent Monitoring', 'Quality Control', 'Real-time Coaching'].map(item => <li key={item} className="flex items-center gap-3 text-slate-700 font-bold"><CheckCircle2 className="text-purple-500 shrink-0" size={20} /> {item}</li>)}
                      </ul>
                  </div>
                  
                  {/* GHOST MODE MOCKUP */}
                  <div className="md:w-1/2 relative group">
                       <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                       <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-slate-900 h-[300px] flex flex-col">
                          <div className="bg-slate-800 p-4 flex justify-between items-center border-b border-slate-700">
                             <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                             </div>
                             <div className="text-xs text-slate-400 font-mono">Spy Mode Active</div>
                          </div>
                          <div className="flex-1 p-6 space-y-4 relative">
                             {/* Chat Content */}
                             <div className="flex gap-3 opacity-50"><div className="w-8 h-8 rounded-full bg-slate-700"></div><div className="bg-slate-800 p-3 rounded-xl w-2/3 h-12"></div></div>
                             <div className="flex gap-3 flex-row-reverse opacity-50"><div className="w-8 h-8 rounded-full bg-slate-700"></div><div className="bg-slate-700 p-3 rounded-xl w-2/3 h-12"></div></div>
                             
                             {/* Overlay Badge */}
                             <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm bg-black/20">
                                 <div className="bg-black/80 border border-purple-500 text-purple-400 px-6 py-3 rounded-full flex gap-3 items-center shadow-[0_0_30px_rgba(168,85,247,0.4)] animate-pulse">
                                     <EyeOff size={20} /> <span className="font-bold tracking-wider">GHOST MODE ON</span>
                                 </div>
                             </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* === FEATURE 3: CONTACT CRM === */}
              <div className="flex flex-col md:flex-row items-center gap-16">
                  <div className="md:w-1/2 space-y-6">
                      <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-[#FF6B00]"><Users size={28} /></div>
                      <h2 className="text-4xl font-bold text-slate-900 leading-tight">Smart Contact CRM</h2>
                      <p className="text-lg text-slate-500 leading-relaxed">
                          Turn your phone book into a powerful CRM. Tag leads, add notes, and filter customers based on their purchase history or interest.
                      </p>
                      <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="text-3xl font-bold text-slate-900 mb-1">Unlimited</div>
                              <div className="text-sm text-slate-500 font-medium">Contacts Storage</div>
                          </div>
                          <div className="p-5 bg-gray-50 rounded-xl border border-gray-100">
                              <div className="text-3xl font-bold text-slate-900 mb-1">Smart</div>
                              <div className="text-sm text-slate-500 font-medium">Segmentation Tags</div>
                          </div>
                      </div>
                  </div>
                  
                  {/* CRM MOCKUP */}
                  <div className="md:w-1/2 relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-orange-400 to-red-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                      <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white h-[320px] flex flex-col">
                          <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
                             <div className="font-bold text-gray-700 flex gap-2 items-center"><Users size={16}/> All Contacts</div>
                             <div className="text-gray-400"><Search size={16}/></div>
                          </div>
                          <div className="divide-y divide-gray-50">
                             {[
                                {n: "Amit Kumar", t: "Lead", c: "bg-green-100 text-green-600"},
                                {n: "Sneha Roy", t: "Interested", c: "bg-blue-100 text-blue-600"},
                                {n: "Rajesh G.", t: "Customer", c: "bg-orange-100 text-orange-600"},
                                {n: "Pooja M.", t: "VIP", c: "bg-purple-100 text-purple-600"},
                             ].map((c, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{c.n[0]}</div>
                                      <div>
                                         <div className="font-bold text-sm text-gray-800">{c.n}</div>
                                         <div className="text-[10px] text-gray-400">+91 98765 43210</div>
                                      </div>
                                   </div>
                                   <span className={`text-[10px] px-2 py-1 rounded font-bold ${c.c}`}>{c.t}</span>
                                </div>
                             ))}
                          </div>
                      </div>
                  </div>
              </div>

          </div>
      </section>

      {/* 5. STATS COUNTER */}
      <section className="py-16 bg-[#FF6B00] text-white">
         <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
               { label: "Messages Sent", val: "10M+" },
               { label: "Active Businesses", val: "500+" },
               { label: "Leads Generated", val: "1.2M+" },
               { label: "Uptime", val: "99.9%" }
            ].map((stat, i) => (
               <div key={i}>
                  <div className="text-4xl md:text-5xl font-black mb-2">{stat.val}</div>
                  <div className="text-orange-100 font-medium">{stat.label}</div>
               </div>
            ))}
         </div>
      </section>

      {/* 6. INDUSTRIES */}
      <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-4xl font-bold text-slate-900 mb-4">Built For Every Business</h2>
                  <p className="text-slate-500 text-xl max-w-2xl mx-auto">Whether you run a clinic, a shop, or a college—Marroncorp adapts to your needs.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                  {industries.map((item, i) => (
                      <div key={i} className="bg-white p-8 rounded-2xl border border-gray-200 hover:border-orange-200 hover:shadow-xl transition-all duration-300">
                          <div className="mb-6 bg-gray-50 w-16 h-16 rounded-xl flex items-center justify-center">{item.icon}</div>
                          <h3 className="text-2xl font-bold text-slate-900 mb-4">{item.title}</h3>
                          <ul className="space-y-3">
                              {item.points.map((pt, k) => <li key={k} className="flex items-start gap-3 text-slate-600"><CheckCircle2 size={20} className="text-[#FF6B00] shrink-0 mt-0.5"/><span>{pt}</span></li>)}
                          </ul>
                      </div>
                  ))}
              </div>
          </div>
      </section>

      {/* 7. FEATURES GRID */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Powerful Features</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">Everything you need to manage leads, automate replies, and scale your business.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {services.map((service, index) => (
              <div key={index} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group cursor-default">
                <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#FF6B00] transition-colors duration-300">
                  <div className="text-[#FF6B00] group-hover:text-white transition-colors duration-300">{service.icon}</div>
                </div>
                <h3 className="text-xl font-bold mb-3 text-slate-900">{service.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 8. TESTIMONIALS */}
      <section className="py-24 bg-white border-t border-gray-100">
         <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-4xl font-bold text-center mb-16 text-slate-900">Loved by Businesses</h2>
            <div className="grid md:grid-cols-3 gap-8">
               {testimonials.map((t, i) => (
                  <div key={i} className="bg-gray-50 p-8 rounded-2xl border border-gray-100 relative">
                     <div className="flex gap-1 mb-4">{[...Array(t.rating)].map((_,k)=><Star key={k} size={16} className="fill-yellow-400 text-yellow-400"/>)}</div>
                     <p className="text-slate-700 italic mb-6">"{t.text}"</p>
                     <div>
                        <div className="font-bold text-slate-900">{t.name}</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">{t.role}</div>
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* 9. FINAL CTA */}
      <section className="py-20 bg-slate-900 text-white text-center">
         <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Ready to Automate Your Business?</h2>
            <p className="text-xl text-slate-400 mb-10">Join 500+ businesses growing with Marroncorp AI. No credit card required.</p>
            <Link to="/signup" className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-orange-600 text-white px-10 py-4 rounded-xl text-lg font-bold transition shadow-2xl shadow-orange-500/20 transform hover:scale-105">
               Start Free Trial <Rocket size={20}/>
            </Link>
         </div>
      </section>

      {/* 10. FAQ */}
      <section className="py-20 bg-white">
         <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Frequently Asked Questions</h2>
            <div className="space-y-4">
               {faqs.map((faq, i) => (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-orange-200 transition shadow-sm">
                     <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex justify-between items-center p-6 text-left font-bold text-slate-800 hover:text-[#FF6B00] transition">
                        <span className="text-lg">{faq.q}</span>
                        {openFaq === i ? <ChevronUp className="w-5 h-5 text-[#FF6B00]"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}
                     </button>
                     <AnimatePresence>
                        {openFaq === i && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-6 pb-6 text-slate-500 text-sm leading-relaxed border-t border-gray-100 pt-4">{faq.a}</motion.div>}
                     </AnimatePresence>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="bg-slate-950 text-white py-16 border-t border-slate-900">
         <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
            <div className="col-span-1">
               <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-[#FF6B00] rounded-lg flex items-center justify-center font-bold text-white">M</div>
                  <span className="font-bold text-xl">Marroncorp</span>
               </div>
               <p className="text-slate-400 text-sm mb-6">Empowering businesses with intelligent WhatsApp automation.</p>
               <div className="flex gap-4">
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:bg-[#FF6B00] transition cursor-pointer"><Facebook size={16}/></div>
                  <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center hover:bg-[#FF6B00] transition cursor-pointer"><Globe size={16}/></div>
               </div>
            </div>
            <div>
               <h4 className="font-bold mb-6 text-[#FF6B00]">Company</h4>
               <ul className="space-y-3 text-slate-400 text-sm">
                  <li><Link to="/about" className="hover:text-white">About Us</Link></li>
                  <li><Link to="/contact" className="hover:text-white">Contact Us</Link></li>
                  <li><Link to="/careers" className="hover:text-white">Careers</Link></li>
               </ul>
            </div>
            <div>
               <h4 className="font-bold mb-6 text-[#FF6B00]">Resources</h4>
               <ul className="space-y-3 text-slate-400 text-sm">
                  <li><Link to="/calculator" className="hover:text-white">ROI Calculator</Link></li>
                  <li><Link to="/docs" className="hover:text-white">API Documentation</Link></li>
                  <li><Link to="/qr-generator" className="hover:text-white">QR Code Generator</Link></li>
               </ul>
            </div>
            <div>
               <h4 className="font-bold mb-6 text-[#FF6B00]">Legal</h4>
               <ul className="space-y-3 text-slate-400 text-sm">
                  <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                  <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
               </ul>
            </div>
         </div>
         <div className="max-w-7xl mx-auto px-6 pt-8 mt-8 border-t border-slate-900 text-center text-slate-500 text-sm">
            &copy; 2025 Marroncorp AI. All rights reserved. Made in India 🇮🇳
         </div>
      </footer>
    </div>
  );
};

// --- SUB-COMPONENT: ANIMATED DEMO ---
const ConversionDemo = () => {
  const [stage, setStage] = useState('ad');
  const [chatStep, setChatStep] = useState(0);

  useEffect(() => {
    let timer;
    if (stage === 'chat') {
       if (chatStep < 4) timer = setTimeout(() => setChatStep(prev => prev + 1), 1500);
    }
    return () => clearTimeout(timer);
  }, [stage, chatStep]);

  const restart = () => { setStage('ad'); setChatStep(0); };

  return (
     <div className="relative w-full max-w-4xl mx-auto h-[500px] bg-white rounded-3xl shadow-2xl overflow-hidden border-8 border-slate-900 flex">
        <div className="hidden md:flex w-1/3 bg-slate-900 text-white p-8 flex-col justify-center border-r border-slate-800">
           <div className="space-y-6">
              <div className={`transition-all duration-500 ${stage === 'ad' ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
                 <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-600 rounded-lg"><Facebook size={20}/></div><h3 className="font-bold">Step 1: The Ad</h3></div>
                 <p className="text-sm text-slate-400">User sees "Free Dental Checkup" on Facebook/Instagram.</p>
              </div>
              <div className={`transition-all duration-500 ${stage === 'chat' ? 'opacity-100 scale-100' : 'opacity-30 scale-95'}`}>
                 <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-green-500 rounded-lg"><MessageSquare size={20}/></div><h3 className="font-bold">Step 2: The Conversion</h3></div>
                 <p className="text-sm text-slate-400">Marroncorp AI handles the chat instantly and books the lead.</p>
              </div>
              <button onClick={restart} className="mt-8 text-xs uppercase tracking-widest text-[#FF6B00] hover:text-white flex items-center gap-2"><Play size={12}/> Replay Animation</button>
           </div>
        </div>
        <div className="w-full md:w-2/3 bg-gray-100 relative">
           <AnimatePresence>
             {stage === 'ad' && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white flex flex-col items-center justify-center p-6">
                  <div className="w-full max-w-sm bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                     <div className="p-3 flex items-center gap-3 border-b border-gray-100"><div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">S</div><div><div className="font-bold text-sm text-slate-800">Shahi Dental Clinic</div><div className="text-xs text-slate-400">Sponsored • 🌍</div></div></div>
                     <div className="h-40 bg-orange-100 flex items-center justify-center text-center p-4"><span className="text-4xl">🦷✨</span></div>
                     <div className="p-4 bg-orange-50"><h4 className="font-bold text-slate-900">Free Dental Checkup Camp!</h4><p className="text-xs text-slate-500 mt-1">Limited slots available. Book via WhatsApp now.</p><button onClick={() => setStage('chat')} className="mt-4 w-full bg-[#25D366] hover:bg-[#1da851] text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-md transition-all animate-pulse"><MessageSquare size={18}/> Chat on WhatsApp</button></div>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
           <AnimatePresence>
             {stage === 'chat' && (
               <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} transition={{ type: 'spring', damping: 20 }} className="absolute inset-0 bg-[#E5DDD5] flex flex-col">
                  <div className="bg-[#075E54] h-16 flex items-center px-4 text-white shadow-md z-10"><ArrowRight onClick={restart} className="mr-3 rotate-180 cursor-pointer"/><div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#075E54] font-bold mr-3">S</div><div><div className="font-bold">Shahi Dental Clinic</div><div className="text-xs opacity-80">Business Account</div></div></div>
                  <div className="flex-1 p-4 space-y-4 overflow-hidden">
                     {chatStep >= 1 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-end ml-auto bg-[#DCF8C6] p-3 rounded-lg rounded-tr-none shadow max-w-[80%] text-sm text-slate-900">Hi, I saw your ad for the free checkup.<div className="text-[10px] text-slate-500 text-right mt-1">10:00 AM ✓✓</div></motion.div>}
                     {chatStep >= 2 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-start mr-auto bg-white p-3 rounded-lg rounded-tl-none shadow max-w-[80%] text-sm text-slate-900">Hello! 👋 Welcome to <b>Shahi Dental Clinic</b>.<br/><br/>Yes, the Free Checkup Camp is live! Would you like to book a slot?<div className="text-[10px] text-slate-400 text-right mt-1">10:00 AM</div></motion.div>}
                     {chatStep >= 3 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-end ml-auto bg-[#DCF8C6] p-3 rounded-lg rounded-tr-none shadow max-w-[80%] text-sm text-slate-900">Yes, please book it.<div className="text-[10px] text-slate-500 text-right mt-1">10:01 AM ✓✓</div></motion.div>}
                     {chatStep >= 4 && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="self-start mr-auto bg-white p-3 rounded-lg rounded-tl-none shadow max-w-[80%] text-sm text-slate-900">✅ <b>Confirmed!</b><br/>Your appointment is set for tomorrow at 5 PM.<br/><br/>📍 Location: Sector 62, Noida. See you there!<div className="text-[10px] text-slate-400 text-right mt-1">10:01 AM</div></motion.div>}
                  </div>
                  <div className="h-14 bg-[#f0f0f0] flex items-center px-4 gap-2"><div className="w-6 h-6 rounded-full bg-slate-300"></div><div className="flex-1 h-9 bg-white rounded-full"></div><div className="w-8 h-8 rounded-full bg-[#075E54] flex items-center justify-center text-white"><Send size={16}/></div></div>
               </motion.div>
             )}
           </AnimatePresence>
        </div>
     </div>
  );
};

export default LandingPage;