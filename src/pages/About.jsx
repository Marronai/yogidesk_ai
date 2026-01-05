import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, CheckCircle2, Users, Rocket, Globe, Menu, X, Heart, 
  Target, ShieldCheck, Zap, Smile, Building, GraduationCap, ShoppingBag, 
  Briefcase, TrendingUp, Clock, MessageCircle 
} from 'lucide-react';
import { motion } from 'framer-motion';

const About = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- DATA SECTIONS ---
  const stats = [
    { label: 'WhatsApp Messages Sent', val: '10M+' },
    { label: 'Happy Clients', val: '500+' },
    { label: 'Uptime Reliability', val: '99.9%' },
    { label: 'Support Availability', val: '24/7' }
  ];

  const values = [
    { icon: <Smile size={32} className="text-[#FF6B00]" />, title: "Customer First", desc: "Every feature we build solves a real business problem." },
    { icon: <ShieldCheck size={32} className="text-blue-500" />, title: "Trust & Transparency", desc: "No hidden charges. Clear pricing. Honest communication." },
    { icon: <TrendingUp size={32} className="text-green-500" />, title: "Growth-Focused", desc: "We grow only when our clients grow." },
    { icon: <Zap size={32} className="text-yellow-500" />, title: "Continuous Improvement", desc: "We constantly improve our platform based on client feedback." },
  ];

  const industries = [
    { icon: <Heart size={24}/>, name: "Clinics & Hospitals" },
    { icon: <GraduationCap size={24}/>, name: "Coaching & Education" },
    { icon: <ShoppingBag size={24}/>, name: "E-commerce & D2C" },
    { icon: <Building size={24}/>, name: "Real Estate" },
    { icon: <Users size={24}/>, name: "Local Shops" },
    { icon: <Rocket size={24}/>, name: "Startups & Agencies" },
  ];

  return (
    <div className="bg-white min-h-screen font-sans text-slate-900 selection:bg-[#FF6B00] selection:text-white">
      
      {/* 1. NAVBAR */}
      <nav className="fixed w-full z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center shadow-lg text-white font-bold text-xl">M</div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Marroncorp</span>
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
          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>{isMenuOpen ? <X /> : <Menu />}</button>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-40 pb-20 px-6 bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-5xl mx-auto text-center">
           <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{duration:0.6}}>
             <span className="inline-block py-1 px-3 rounded-full bg-orange-100 text-[#FF6B00] text-xs font-bold uppercase tracking-widest mb-6">Our Mission</span>
             <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 leading-tight">
                We Help Businesses Respond Faster, <br/> 
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-600">Sell Smarter & Grow Confidently.</span>
             </h1>
             <p className="text-xl text-slate-500 leading-relaxed max-w-3xl mx-auto">
                "Customers don’t wait. Businesses lose leads when replies are late." <br/>
                We are here to change that forever.
             </p>
           </motion.div>
        </div>
      </section>

      {/* 3. OUR STORY (The Problem & Solution) */}
      <section className="py-24 bg-white">
         <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
            <motion.div initial={{opacity:0, x:-50}} whileInView={{opacity:1, x:0}} viewport={{once:true}}>
               <h2 className="text-3xl font-bold mb-6 text-slate-900">The Problem We Saw</h2>
               <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
                  <p>
                    Marroncorp started with a clear problem: <b>Businesses were getting leads, but they couldn't reply fast enough.</b>
                  </p>
                  <ul className="space-y-3">
                     <li className="flex items-center gap-3"><X className="text-red-500" size={20}/> Phone calls were missed.</li>
                     <li className="flex items-center gap-3"><X className="text-red-500" size={20}/> WhatsApp messages piled up.</li>
                     <li className="flex items-center gap-3"><X className="text-red-500" size={20}/> Follow-ups were forgotten.</li>
                  </ul>
                  <p className="border-l-4 border-[#FF6B00] pl-4 italic text-slate-800">
                     "As customers moved on, businesses lost revenue — silently."
                  </p>
               </div>
            </motion.div>
            
            <motion.div initial={{opacity:0, x:50}} whileInView={{opacity:1, x:0}} viewport={{once:true}} className="bg-slate-900 text-white p-10 rounded-3xl shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B00] rounded-full blur-[100px] opacity-20"></div>
               <h3 className="text-2xl font-bold mb-6">So We Built The Solution.</h3>
               <p className="text-slate-300 mb-6 leading-relaxed">
                  We decided to fix this using the <b>Official WhatsApp API</b>, combined with smart automation and simple tools that even non-technical teams can use.
               </p>
               <div className="grid grid-cols-2 gap-6 mt-8">
                  <div className="bg-slate-800 p-4 rounded-xl">
                     <Clock className="text-[#FF6B00] mb-2" size={24}/>
                     <div className="font-bold">24/7 Active</div>
                     <div className="text-xs text-slate-400">Never miss a lead</div>
                  </div>
                  <div className="bg-slate-800 p-4 rounded-xl">
                     <MessageCircle className="text-[#FF6B00] mb-2" size={24}/>
                     <div className="font-bold">Instant Reply</div>
                     <div className="text-xs text-slate-400">Under 2 seconds</div>
                  </div>
               </div>
            </motion.div>
         </div>
      </section>

      {/* 4. IMPACT STATS */}
      <section className="py-20 bg-[#FF6B00] text-white">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-12 opacity-90">Our Impact So Far</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
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
      <section className="py-24 bg-gray-50">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold text-slate-900 mb-4">Built for Businesses Like Yours</h2>
            <p className="text-slate-500 mb-12">Whether you’re a small clinic or a scaling startup, we are designed for you.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
      <section className="py-24 bg-white">
         <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
               <span className="text-[#FF6B00] font-bold tracking-widest uppercase text-sm">Core Principles</span>
               <h2 className="text-4xl font-bold text-slate-900 mt-2">What Drives Us</h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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

      {/* 7. TEAM SECTION (Existing Retained) */}
      <section className="py-24 bg-slate-900 text-white border-t border-slate-800">
         <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-3xl font-bold mb-4">Meet The Team</h2>
            <p className="text-slate-400 mb-16">The passionate people behind the product.</p>
            
            <div className="grid md:grid-cols-3 gap-8">
               {[
                  {name: "Avinash Kumar", role: "Founder & CEO", img: "https://placehold.co/200"},
                  {name: "Rahul Singh", role: "CTO", img: "https://placehold.co/200"},
                  {name: "Priya Sharma", role: "Head of Growth", img: "https://placehold.co/200"},
               ].map((member, i) => (
                  <div key={i} className="bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-[#FF6B00] transition group">
                     <div className="w-32 h-32 mx-auto mb-6 relative">
                        <div className="absolute inset-0 bg-[#FF6B00] rounded-full transform scale-105 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                        <img src={member.img} alt={member.name} className="relative w-full h-full rounded-full border-4 border-slate-700 object-cover"/>
                     </div>
                     <h3 className="text-xl font-bold">{member.name}</h3>
                     <p className="text-[#FF6B00] font-bold text-sm mt-1">{member.role}</p>
                  </div>
               ))}
            </div>
         </div>
      </section>

      {/* 8. CTA SECTION */}
      <section className="py-20 bg-white text-center">
         <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-4xl font-black text-slate-900 mb-6">Let’s Grow Together 🚀</h2>
            <p className="text-xl text-slate-500 mb-10">
               Ready to stop losing leads and start converting conversations into customers?
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 bg-[#FF6B00] hover:bg-orange-600 text-white px-10 py-4 rounded-xl text-lg font-bold transition shadow-xl shadow-orange-200 transform hover:scale-105">
               Start Free Trial
            </Link>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-white py-12 text-center border-t border-slate-900">
         <p className="text-slate-500 flex items-center justify-center gap-2">
           © 2025 Marroncorp AI. Made with <Heart size={16} className="text-red-500 fill-red-500"/> in India.
         </p>
      </footer>
    </div>
  );
};

export default About;