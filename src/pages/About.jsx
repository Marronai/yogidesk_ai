import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, CheckCircle2, Users, Rocket, Globe, Menu, X, Heart, 
  Target, ShieldCheck, Zap, Smile, Building, GraduationCap, ShoppingBag, 
  Briefcase, TrendingUp, Clock, MessageCircle, DollarSign, Smartphone
} from 'lucide-react';
import { motion } from 'framer-motion';

const About = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const stats = [
    { label: 'WhatsApp Messages Sent', val: '10M+' },
    { label: 'Happy Clients', val: '500+' },
    { label: 'Uptime Reliability', val: '99.9%' },
    { label: 'Support Availability', val: '24/7' }
  ];

  const values = [
    { icon: <Smile size={32} className="text-[#FF6B00]" />, title: "Patient First", desc: "Every feature we build solves a real healthcare communication problem." },
    { icon: <ShieldCheck size={32} className="text-blue-500" />, title: "Trust & Transparency", desc: "No hidden charges. Clear pricing. Honest communication." },
    { icon: <TrendingUp size={32} className="text-green-500" />, title: "Care-Focused", desc: "We grow only when our healthcare teams serve patients better." },
    { icon: <Zap size={32} className="text-yellow-500" />, title: "Continuous Improvement", desc: "We constantly improve our platform based on client feedback." },
  ];

  const industries = [
    { icon: <Heart size={24}/>, name: "Clinics & Hospitals" },
    { icon: <GraduationCap size={24}/>, name: "Doctors & Specialists" },
    { icon: <ShoppingBag size={24}/>, name: "Diagnostic Centers" },
    { icon: <Building size={24}/>, name: "Hospitals" },
    { icon: <Users size={24}/>, name: "Healthcare Teams" },
    { icon: <Rocket size={24}/>, name: "Wellness Clinics" },
  ];

  return (
    <div className="bg-white min-h-screen font-sans text-slate-900 selection:bg-[#FF6B00] selection:text-white">
      
      {/* 1. NAVBAR */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center shadow-lg text-white font-bold text-xl">Y</div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Yogi Desk AI</span>
          </Link>
          <div className="hidden md:flex gap-8 text-sm font-bold text-slate-600 items-center">
            <Link to="/" className="hover:text-[#FF6B00] transition">Home</Link>
            <Link to="/about" className="text-[#FF6B00] transition">About Us</Link>
            <Link to="/pricing" className="hover:text-[#FF6B00] transition">Pricing</Link>
            <Link to="/contact" className="hover:text-[#FF6B00] transition">Contact</Link>
          </div>
          <div className="hidden md:flex gap-4">
             <Link to="/login" className="text-sm font-bold text-slate-600 hover:text-[#FF6B00] py-2">Log In</Link>
             <Link to="/signup" className="bg-[#FF6B00] hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 transform hover:-translate-y-0.5 transition">Get Started <ArrowRight size={16}/></Link>
          </div>
          <button className="md:hidden text-slate-900" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-gray-100 px-6 pt-4 pb-6 space-y-4 flex flex-col font-bold text-slate-700">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00]">Home</Link>
            <Link to="/about" onClick={() => setIsMenuOpen(false)} className="text-[#FF6B00]">About Us</Link>
            <Link to="/pricing" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00]">Pricing</Link>
            <Link to="/contact" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00]">Contact</Link>
            <hr className="border-gray-100" />
            <Link to="/login" onClick={() => setIsMenuOpen(false)} className="hover:text-[#FF6B00] py-2">Log In</Link>
            <Link to="/signup" onClick={() => setIsMenuOpen(false)} className="bg-[#FF6B00] text-white text-center py-3 rounded-xl">Get Started</Link>
          </div>
        )}
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-32 md:pt-40 pb-12 md:pb-20 lg:pb-24 px-4 md:px-6 bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
           <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{duration:0.6}}>
             <span className="inline-block py-1 px-3 rounded-full bg-orange-100 text-[#FF6B00] text-xs font-bold uppercase tracking-widest mb-6">Our Legacy</span>
             <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-tight text-slate-900 mb-6">
                An Absolute Healthcare technology company India <br/> 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-600">Powering WhatsApp automation for medical professionals.</span>
             </h1>
             <p className="text-xl md:text-2xl text-slate-700 leading-relaxed max-w-4xl mx-auto">
               As a premier digital health communication platform, we craft custom patient care software solution pipelines. Yogi Desk operates as the medical practice automation experts that modern practices trust.
             </p>
           </motion.div>
        </div>
      </section>

      {/* 🚀 NEW SECTION 1: INDIA'S 1ST DOCTOR-CENTRIC WHATSAPP API */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-white border-t border-gray-50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <motion.div initial={{opacity:0, x:-30}} whileInView={{opacity:1, x:0}} viewport={{once:true}}>
            <span className="text-[#FF6B00] font-bold text-sm tracking-wider uppercase">India's First & Only</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-2 mb-6">
              Exclusive WhatsApp Business API Provider Specially Crafted For Doctors, Hospitals & Clinics
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-6">
              Unlike generic platforms built for e-commerce, Yogi Desk is a company building WhatsApp solutions for doctors. We are a specialized healthcare technology company India dedicated strictly to medical environments. This patient-doctor communication platform enables seamless booking tracking without automated retail configurations getting in the way.
            </p>
            <p className="text-slate-600 text-lg leading-relaxed">
              Our unique digital health communication platform provides clear interfaces built explicitly for medical workflow automation. This allows compound clinics to operate as true medical practice automation experts with custom integrations.
            </p>
          </motion.div>
          <motion.div initial={{opacity:0, x:30}} whileInView={{opacity:1, x:0}} viewport={{once:true}} className="bg-gray-100 p-4 rounded-3xl border border-gray-200 shadow-xl">
            {/* Dashboard Visual Mockup Placeholder */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white font-mono text-xs shadow-inner">
              <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-slate-500 ml-2">Yogi Desk AI — WhatsApp Automation Central Dashboard</span>
              </div>
              <div className="space-y-3">
                <p className="text-green-400">// Active Medical Channels Connected Successfully</p>
                <p className="text-slate-300">Total Enquiries Captured: <span className="text-orange-400">14,205</span></p>
                <p className="text-slate-300">Automated Appointment Bookings Counter: <span className="text-[#FF6B00]">3,892</span></p>
                <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 mt-4 font-sans">
                  <p className="text-xs text-slate-400 font-bold mb-1">Incoming Smart Patient Log Preview:</p>
                  <p className="text-white text-sm">"Hi Doctor, want to reserve an appointment for tomorrow at 10 AM."</p>
                  <p className="text-[#FF6B00] text-xs font-bold mt-2">✓ Yogi AI Engine Auto-Replied with Booking Confirmation Slip</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 💰 NEW SECTION 2: 99% COST SAVING COMPARISON */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <motion.div initial={{opacity:0, scale:0.95}} whileInView={{opacity:1, scale:1}} viewport={{once:true}} className="order-2 lg:order-1 bg-white p-8 rounded-3xl border border-gray-200 shadow-lg flex flex-col justify-center">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-slate-800">Market Standard API Price</span>
              <span className="text-red-500 line-through font-bold">₹15,0000 / Mo</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-orange-50 border border-orange-200 rounded-2xl mb-4">
              <span className="font-black text-slate-900">Yogi Desk AI Specialized Rate</span>
              <span className="text-2xl font-black text-[#FF6B00]">99% More Affordable</span>
            </div>
            <p className="text-xs text-slate-400 text-center mt-2">Every plan comes packed with complete dashboard integrations and messaging access logs.</p>
          </motion.div>
          <motion.div initial={{opacity:0, x:30}} whileInView={{opacity:1, x:0}} viewport={{once:true}} className="order-1 lg:order-2">
            <span className="bg-green-100 text-green-700 font-bold text-xs uppercase px-3 py-1 rounded-full">Disruptive Pricing Structure</span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-2 mb-6">
              Our Cost Structure Is 99% More Affordable Than Any Other Generic Provider in the Market
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-4">
              We understand that running a clinic requires careful expense tracking. As a trusted medical practice software provider, our mission is to scale deep healthcare digital transformation across regional clinics without heavy software fees. Our healthcare CRM innovation brings down expenses radically.
            </p>
            <p className="text-slate-600 text-lg leading-relaxed">
              By working directly with structural routes as a premier WhatsApp Business solution provider, we completely eliminate bulk markup pricing models. This strategy allows us to deliver a patient care software solution at almost zero margin, keeping the ecosystem accessible.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 🧩 NEW SECTION 3: 3-STEP SYSTEM DESIGNED FOR DOCTORS */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-white">
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-[#FF6B00] font-bold text-sm uppercase tracking-wider">Zero Training Required</span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-2 mb-6">
            Designed Exclusively For Busy Medical Professionals — Operates In Simple 3 Steps Just Like Normal WhatsApp
          </h2>
          <p className="text-slate-600 text-lg max-w-3xl mx-auto mb-16">
            We know doctors do not have hours to study complicated dashboard tech. That is why this entire WhatsApp automation for medical professionals ecosystem sets up instantly. Doctors can start using it effectively from Day 1 to achieve true medical workflow automation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 border border-gray-100 p-8 rounded-2xl relative shadow-sm">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-10 h-10 bg-[#FF6B00] text-white font-black rounded-full flex items-center justify-center shadow-md">1</div>
              <h3 className="text-xl font-bold mt-2 mb-3">Connect Identity</h3>
              <p className="text-slate-500 text-sm">Scan your secure QR code channel signature in 10 seconds flat to activate integration logs.</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-8 rounded-2xl relative shadow-sm">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-10 h-10 bg-slate-900 text-white font-black rounded-full flex items-center justify-center shadow-md">2</div>
              <h3 className="text-xl font-bold mt-2 mb-3">Pick Templates</h3>
              <p className="text-slate-500 text-sm">Select pre-approved healthcare communication technology India compliant messages instantly.</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-8 rounded-2xl relative shadow-sm">
              <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 w-10 h-10 bg-orange-600 text-white font-black rounded-full flex items-center justify-center shadow-md">3</div>
              <h3 className="text-xl font-bold mt-2 mb-3">Automate Care</h3>
              <p className="text-slate-500 text-sm">Let the AI engine track patient enquiries and handle booking routing seamlessly in the background.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. OUR STORY (The Problem & Solution) */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-gray-50 border-t border-gray-100">
         <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div initial={{opacity:0, x:-50}} whileInView={{opacity:1, x:0}} viewport={{once:true}}>
               <h2 className="text-3xl font-bold mb-6 text-slate-900">The Problem We Saw</h2>
               <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
                  <p>
                    Yogi Desk AI started when we realized that even though we are a top healthcare technology company India provider, clinics were still getting patient enquiries but couldn't reply fast enough.
                  </p>
                  <ul className="space-y-3">
                     <li className="flex items-center gap-3"><X className="text-red-500" size={20}/> Urgent patient care software solution needs went unaddressed.</li>
                     <li className="flex items-center gap-3"><X className="text-red-500" size={20}/> Core WhatsApp automation for medical professionals requests failed to scale.</li>
                     <li className="flex items-center gap-3"><X className="text-red-500" size={20}/> Operations needed dedicated medical practice automation experts input.</li>
                  </ul>
                  <p className="border-l-4 border-[#FF6B00] pl-4 italic text-slate-800">
                     "As patient-doctor communication platform queues choked, clinics lost structural opportunities."
                  </p>
               </div>
            </motion.div>
            
            <motion.div initial={{opacity:0, x:50}} whileInView={{opacity:1, x:0}} viewport={{once:true}} className="bg-slate-900 text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B00] rounded-full blur-[100px] opacity-20"></div>
               <h3 className="text-2xl font-bold mb-6">So We Built The Solution.</h3>
               <p className="text-slate-300 mb-6 leading-relaxed">
                  We engineered an integrated digital health communication platform layout. By establishing a dynamic healthcare communication technology India hub, we enable doctors to deploy reliable medical workflow automation features smoothly.
               </p>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
                  <div className="bg-slate-800 p-4 rounded-xl">
                     <Clock className="text-[#FF6B00] mb-2" size={24}/>
                     <div className="font-bold">24/7 Active</div>
                     <div className="text-xs text-slate-400">Never miss a tracking slot</div>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-xl">
                     <MessageCircle className="text-[#FF6B00] mb-2" size={24}/>
                     <div className="font-bold">Instant Reply</div>
                     <div className="text-xs text-slate-400">Under 2 seconds flat</div>
                  </div>
               </div>
            </motion.div>
         </div>
      </section>

      {/* 4. IMPACT STATS */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-[#FF6B00] text-white">
         <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-12 opacity-90">Our Impact So Far</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
               {stats.map((stat, i) => (
                  <div key={i} className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                     <div className="text-4xl md:text-5xl font-black mb-2">{stat.val}</div>
                     <div className="text-orange-100 font-medium text-sm uppercase tracking-wider">{stat.label}</div>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* 5. INDUSTRIES WE SERVE */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-gray-50">
         <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Built for Healthcare Teams Like Yours</h2>
            <p className="text-slate-500 mb-12">Whether you're a small clinic or a growing hospital, our healthcare digital transformation hub is ready.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
               {industries.map((ind, i) => (
                  <motion.div 
                    whileHover={{scale: 1.05}} 
                    key={i} 
                    className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-3 hover:border-orange-200 transition-colors"
                  >
                     <div className="text-[#FF6B00] bg-orange-50 p-3 rounded-full">{ind.icon}</div>
                     <span className="font-bold text-sm text-slate-700">{ind.name}</span>
                  </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* 6. OUR VALUES */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-white">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
               <span className="text-[#FF6B00] font-bold tracking-widest uppercase text-sm">Core Principles</span>
               <h2 className="text-4xl font-bold text-slate-900 mt-2">What Drives Us</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
               {values.map((val, i) => (
                  <div key={i} className="p-8 rounded-3xl bg-gray-50 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                     <div className="mb-6 bg-white w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm">{val.icon}</div>
                     <h3 className="text-xl font-bold text-slate-900 mb-3">{val.title}</h3>
                     <p className="text-slate-500 text-sm leading-relaxed">{val.desc}</p>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* 8. BUSINESS AUDIT OVERVIEW SECTION */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-gray-50 text-slate-700 text-sm leading-relaxed border-t border-gray-100">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <p>Yogi Desk operates cleanly as a top-tier WhatsApp Business solution provider. Our operational core provides deep patient-doctor communication platform mapping across regional centers. We remain a dedicated healthcare technology company India provider committed to scaling functional infrastructure.</p>
          <p>By connecting custom pipelines as medical practice automation experts, our teams ensure that each patient care software solution conforms to optimal industry standards. We serve natively as a trusted medical practice software provider across the sub-continent.</p>
          <p>Our ongoing healthcare CRM innovation milestones establish us as a premier company building WhatsApp solutions for doctors. Our stack simplifies complex setups into intuitive tools, enabling rapid medical workflow automation adoption.</p>
          <p>Through systematic WhatsApp automation for medical professionals routing protocols, we reduce infrastructure overloads. Yogi Desk remains the definitive digital health communication platform hub that accelerates healthcare digital transformation timelines effortlessly.</p>
        </div>
      </section>

      {/* 9. CTA SECTION */}
      <section className="py-12 md:py-20 lg:py-24 px-4 md:px-6 bg-white text-center">
         <div className="max-w-3xl mx-auto">
            <h2 className="text-4xl font-black text-slate-900 mb-6">Let’s Grow Together 🚀</h2>
            <p className="text-xl text-slate-500 mb-10">
               Ready to connect with a trusted medical practice software provider and optimize your healthcare communication technology India infrastructure?
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-orange-600 text-white px-10 py-4 rounded-xl text-lg font-bold transition shadow-xl shadow-orange-200 transform hover:scale-105">
               Start with ₹50 Credits
            </Link>
         </div>
      </section>
    </div>
  );
};

export default About;
