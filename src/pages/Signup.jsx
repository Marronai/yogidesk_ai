import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, Building, Mail, Lock, Phone, ArrowRight, Loader2, 
  Star, CheckCircle, Eye, EyeOff, Briefcase 
} from 'lucide-react';
import { motion } from 'framer-motion';

// ⭐ Supabase Client Import (Aapne jo file banayi thi)
import { supabase } from '../supabaseClient';
import { persistSupabaseSession } from '../utils/authSession';

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Signup Steps State (1 = Details, 2 = Confirm/Activation Screen)
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    password: '',
    businessType: 'Clinic',
    businessCategory: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ HELPER: LocalStorage token configuration dashboard navigation ke liye
  const handleAuthSuccess = (supabaseUser) => {
    try {
      if (supabaseUser) {
        persistSupabaseSession(supabaseUser, {
          name: formData.name,
          businessCategory: formData.businessCategory,
          welcomeGift: true,
        });
        
        // 🚀 Seedha Dashboard!
        navigate('/dashboard');
      }
    } catch (error) {
      console.error("Local Storage Token Save Error", error);
    }
  };

  // Google Login Logic (Supabase Auth Module)
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-success`
        }
      });
      if (error) throw error;
    } catch (err) {
      alert(err.message || "Google Signup Failed");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 MAIN MANUAL SIGNUP LOGIC (Supabase Auth Injected)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10);

    if (cleanPhone && cleanPhone.length !== 10) {
      alert("Please enter a valid 10-digit phone number");
      setLoading(false);
      return;
    }

    try {
      if (step === 1) {
        // --- STEP 1: REGISTER WITH SUPABASE AUTH ---
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name.trim(),
              business_name: formData.businessName.trim(),
              business_category: formData.businessCategory,
              phone: cleanPhone
            }
          }
        });

        if (error) throw error;

        if (data?.session?.user) {
          handleAuthSuccess(data.session.user);
          return;
        }

        // Public Profiles table backup logic (Optional profile trigger)
        if (data?.user) {
          setStep(2); // Move to Activation screen interface
          alert(`🎉 Yogi Desk Account Triggered! Verification email sent to ${cleanEmail}`);
        }
      } else {
        // --- STEP 2: BYPASS/MANUAL SIGNIN FROM COOLDOWN SCREEN ---
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: formData.password,
        });

        if (signInError) {
          alert("Account is waiting for verification link or password incorrect.");
        } else {
          handleAuthSuccess(signInData.user);
        }
      }
    } catch (error) {
      alert(error.message || "Signup Failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row w-full bg-white font-sans overflow-hidden">
      
      {/* LEFT SIDE: BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative justify-center items-center overflow-hidden p-12">
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-[#FF6B00] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-20"></div>

        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }} 
          className="relative z-10 max-w-lg text-white"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-orange-300 mb-8 uppercase tracking-wider">
             <Star size={12} className="fill-orange-300"/> Join 10,000+ Doctors & Clinics
          </div>
          <h1 className="text-5xl font-black leading-tight mb-6">
             Power your clinic with <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-400">Yogi Desk.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
             Start with prepaid WhatsApp credits, built for doctors, clinics, hospitals and healthcare teams.
          </p>
          <ul className="space-y-5">
             {['Instant Patient Dashboard Access', 'Admin Appointment Tools Unlocked', 'WhatsApp Meta API Ready'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-lg font-medium text-slate-200">
                   <div className="bg-[#FF6B00]/20 p-1 rounded-full"><CheckCircle size={20} className="text-[#FF6B00]"/></div> 
                   {item}
                </li>
             ))}
          </ul>
        </motion.div>
      </div>

      {/* RIGHT SIDE: SIGNUP FORM */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 lg:p-12 bg-white overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-md z-10 py-10"
        >
          <div className="mb-8 text-center lg:text-left">
             <h2 className="text-3xl font-black text-gray-900 mb-2">
               {step === 1 ? "Create your Yogi Desk account" : "Activate your account"}
             </h2>
             <p className="text-gray-500">
               {step === 1 ? "Create your clinic workspace and receive Rs. 50 WhatsApp credits." : `We've sent an activation tracking link to ${formData.email}`}
             </p>
          </div>

          <button 
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-all mb-6"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            Sign up with Google
          </button>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-bold">Or register with email</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                       <User size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                       <input name="name" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" placeholder="Full Name" required/>
                    </div>
                    <div className="relative">
                       <Building size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                       <input name="businessName" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" placeholder="Clinic/Hospital Name" required/>
                    </div>
                </div>

                <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input name="email" type="email" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" placeholder="Email Address" required/>
                </div>

                <div className="relative">
                    <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input 
                      name="phone" 
                      type="tel" 
                      onChange={handleChange} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" 
                      placeholder="WhatsApp Number (10 digits)" 
                      pattern="[0-9]{10}" 
                      maxLength="10"
                      required
                    />
                </div>

                <div className="relative">
                    <Briefcase size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <select 
                      name="businessCategory" 
                      onChange={handleChange} 
                      value={formData.businessCategory}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" 
                      required
                    >
                      <option value="" disabled>Select Medical Specialization</option>
                      <option value="Dentist">Dentist</option>
                      <option value="Cardiologist">Cardiologist</option>
                      <option value="Diabetologist">Diabetologist</option>
                      <option value="General Physician">General Physician</option>
                      <option value="Pediatrician">Pediatrician</option>
                      <option value="Gynecologist">Gynecologist</option>
                      <option value="Dermatologist">Dermatologist</option>
                      <option value="Others">Others</option>
                    </select>
                </div>

                <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input 
                      name="password" 
                      type={showPassword ? "text" : "password"} 
                      onChange={handleChange} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-12 p-3 outline-none focus:border-[#FF6B00]" 
                      placeholder="Password" 
                      required
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-gray-400"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                </div>

                <button disabled={loading} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-6">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "Create Yogi Desk Account"} 
                  {!loading && <ArrowRight size={20}/>}
                </button>
              </>
            ) : (
              <>
                {/* Visual Placeholder for Link Activation confirmation */}
                <div className="text-center p-6 bg-orange-50 border border-orange-100 rounded-xl mb-4">
                   <p className="text-sm text-orange-700 font-medium">
                     Please click on the confirmation link sent to your email box to activate database records.
                   </p>
                </div>

                <button disabled={loading} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-4">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "I've Verified, Let's Login"} 
                  {!loading && <ArrowRight size={20}/>}
                </button>

                <button 
                  type="button" 
                  onClick={() => setStep(1)} 
                  className="w-full text-gray-500 py-2 rounded-xl font-medium transition hover:text-gray-700"
                >
                  ← Back to Edit Details
                </button>
              </>
            )}
          </form>

          <p className="mt-8 text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="font-bold text-[#FF6B00] hover:underline">Log In</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
