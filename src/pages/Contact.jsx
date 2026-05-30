import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, MessageSquare, ArrowRight, Send, Check } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    // Yahan API call lag sakti hai
  };

  return (
    <div className="bg-white min-h-screen font-sans text-slate-900 selection:bg-[#FF6B00] selection:text-white">
      
      <PublicNavbar />

      <section className="pt-32 pb-20 px-6">
         <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-start">
            
            {/* LEFT SIDE: INFO */}
            <div className="space-y-10">
               <div>
                 <span className="text-[#FF6B00] font-bold tracking-widest uppercase text-sm mb-2 block">Get In Touch</span>
                 <h1 className="text-5xl font-black text-slate-900 mb-4">Let's Talk Healthcare.</h1>
                 <p className="text-xl text-slate-500">
                    Have questions about pricing, API integration, or custom healthcare team plans? We are here to help.
                 </p>
               </div>
               
               <div className="space-y-6">
                  {/* WhatsApp Priority Card */}
                  <div className="flex items-start gap-5 p-6 bg-green-50 rounded-2xl border border-green-100 shadow-sm hover:shadow-md transition-all group">
                     <div className="bg-[#25D366] text-white p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform"><MessageSquare size={24}/></div>
                     <div>
                        <h3 className="font-bold text-lg text-slate-900">Chat on WhatsApp</h3>
                        <p className="text-slate-500 text-sm mb-3">Fastest way to get support (Typically replies in 5 mins).</p>
                        <button className="text-[#25D366] font-bold text-sm hover:underline flex items-center gap-1">Click to Start Chat <ArrowRight size={14}/></button>
                     </div>
                  </div>

                  <div className="flex items-start gap-5">
                     <div className="bg-gray-100 p-3 rounded-xl"><Mail size={24} className="text-slate-700"/></div>
                     <div>
                        <h3 className="font-bold text-slate-900">Email Us</h3>
                        <p className="text-slate-500">support@yogidesk-ai.com</p>
                        <p className="text-slate-500">sales@yogidesk-ai.com</p>
                     </div>
                  </div>

                  <div className="flex items-start gap-5">
                     <div className="bg-gray-100 p-3 rounded-xl"><MapPin size={24} className="text-slate-700"/></div>
                     <div>
                        <h3 className="font-bold text-slate-900">Headquarters</h3>
                        <p className="text-slate-500">New Alkapuri Gardanibhag Road No 14<br/>Patna,Bihar -800002 India</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* RIGHT SIDE: FORM */}
            <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-gray-100 relative overflow-hidden">
               {submitted ? (
                 <div className="text-center py-20">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><Check size={32}/></div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">Message Sent!</h3>
                    <p className="text-slate-500">We will get back to you shortly.</p>
                    <button onClick={() => setSubmitted(false)} className="mt-6 text-[#FF6B00] font-bold text-sm hover:underline">Send another message</button>
                 </div>
               ) : (
                 <>
                   <h3 className="text-2xl font-bold mb-6 text-slate-900">Send us a message</h3>
                   <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid grid-cols-2 gap-5">
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Name</label>
                            <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100 outline-none transition" placeholder="John Doe" required/>
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</label>
                            <input type="text" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100 outline-none transition" placeholder="+91 9876..."/>
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                            <input type="email" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100 outline-none transition" placeholder="doctor@clinic.com" required/>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message</label>
                         <textarea rows="4" className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100 outline-none transition" placeholder="Tell us about your requirements..." required></textarea>
                      </div>
                      <button type="submit" className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-orange-200 transform hover:-translate-y-1">
                         Send Message <Send size={18}/>
                      </button>
                   </form>
                 </>
               )}
            </div>

         </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-950 text-white py-12 text-center border-t border-slate-900">
         <p className="text-slate-500">© 2026 Yogi Desk AI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Contact;
