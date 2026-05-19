import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, Star, Eye, EyeOff, CheckCircle2, ShieldCheck, KeyRound, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ⭐ Supabase Client Import
import { handleGoogleSignIn, supabase } from '../config/supabaseClient';
import { persistSupabaseSession } from '../utils/authSession';
import { API_URL } from '../utils/api';
import { startFirebasePhoneChallenge } from '../utils/firebasePhoneAuth';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [pendingUser, setPendingUser] = useState(null);
  
  // Login Steps State (1 = Credentials, 2 = Fallback Link verification state)
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]); 

  const [formData, setFormData] = useState({ email: '', password: '', phone: '' });

  // --- CAROUSEL DATA (Updated to Yogi Desk Branding) ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { text: "Yogi Desk changed how we handle leads. We went from missing appointments to replying instantly.", author: "Dr. Jay Sharma", role: "Founder, Dental Care", type: "testimonial" },
    { text: "Sending automated WhatsApp reminders has never been safer. Zero bans in 6 months!", author: "Dr. Priya Menon", role: "Clinic Head, Healthcare Team", type: "testimonial" },
    { text: "Automate your clinic appointment confirmations while you sleep. The #1 WhatsApp AI Tool for Indian Doctors.", author: null, role: null, type: "feature" }
  ];

  useEffect(() => {
    // 🛡️ DEVICE FINGERPRINT SECURITY CHECK
    const verifyFingerprint = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const currentFingerprint = navigator.userAgent;
        const savedFingerprint = session.user.user_metadata?.last_fingerprint;
        
        if (savedFingerprint && savedFingerprint !== currentFingerprint) {
          console.warn("Security Alert: Session fingerprint mismatch detected.");
          await supabase.auth.signOut();
          navigate('/login', { replace: true });
        }
      }
    };

    verifyFingerprint();
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % slides.length), 4000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return false;
    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);
    if (element.value && element.nextSibling) {
      element.nextSibling.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (!otp[index] && e.target.previousSibling) {
        e.target.previousSibling.focus();
      }
    }
  };

  const triggerLoginEmail = (user) => {
    const payload = JSON.stringify({
      email: user?.email || formData.email.trim().toLowerCase(),
      name: user?.user_metadata?.full_name || user?.user_metadata?.name || 'Doctor',
      event: 'login'
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_URL}/api/auth/dispatch-login-alert`, new Blob([payload], { type: 'application/json' }));
      return;
    }

    fetch(`${API_URL}/api/auth/dispatch-login-alert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  };

  const startLoginPhoneVerification = async (user) => {
    const phone = formData.phone || user?.user_metadata?.phone;
    const confirmation = await startFirebasePhoneChallenge({
      phone,
      containerId: 'recaptcha-container',
      verifierKey: 'login',
    });
    setPendingUser(user);
    setPhoneConfirmation(confirmation);
    setOtp(["", "", "", "", "", ""]);
    setStep(2);
  };

  // 🌍 GOOGLE LOGIN HANDLER (Supabase Native Auth)
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await handleGoogleSignIn();
      if (error) throw error;
    } catch (error) {
      alert("Google Login Failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ ENHANCED SUCCESS HANDLER (Saves session with fingerprint and persistence config)
  const handleAuthSuccess = async (supabaseUser) => {
    try {
        // 🔐 Update device fingerprint in metadata for future session validation
        await supabase.auth.updateUser({
          data: { last_fingerprint: navigator.userAgent }
        });

        // Enforce storage persistence
        persistSupabaseSession(supabaseUser);
        localStorage.setItem('user_subscription_status', 'active');

        if (!rememberMe) {
          // Transient session logic: session storage only
          sessionStorage.setItem('user_id', supabaseUser.id);
          sessionStorage.setItem('user_email', supabaseUser.email || '');
          sessionStorage.setItem('token', `supabase-bypass-token-${supabaseUser.id}`);
          
          // Remove from local storage if rememberMe is false to ensure session ends with tab
          localStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token');
        } else {
          // Persistence explicitly in localStorage handled by default Supabase config, 
          // but we ensure our custom keys follow suit.
          localStorage.setItem('user_id', supabaseUser.id);
          localStorage.setItem('user_email', supabaseUser.email || '');
        }
        
        // 🚀 Redirect to Main Dashboard
        navigate('/dashboard', { replace: true });
    } catch (error) {
        console.error("Session LocalStorage Save Error", error);
        alert("Login completed with validation anomalies.");
    }
  };

  // 🚀 MAIN SUBMIT HANDLER (Supabase Auth Integration)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = formData.email.trim().toLowerCase();

    try {
      if (step === 1) {
        // Clear any lingering session keys
        localStorage.removeItem('user_id');
        localStorage.removeItem('token');
        sessionStorage.removeItem('user_id');
        sessionStorage.removeItem('token');

        // --- SUPABASE PASSWORD SIGN IN ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: formData.password,
        });

        if (error) throw error;

        if (data?.user) {
          await startLoginPhoneVerification(data.user);
        }
      } else {
        const code = otp.join('');
        if (!phoneConfirmation || code.length !== 6) {
          alert("Please enter the 6-digit mobile OTP.");
          return;
        }

        await phoneConfirmation.confirm(code);
        triggerLoginEmail(pendingUser);
        handleAuthSuccess(pendingUser);
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Invalid Email or Password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full bg-white font-sans overflow-hidden">
      
      {/* 1. LEFT SIDE: BRANDING & CAROUSEL */}
      <div className="hidden md:flex md:order-1 w-full md:w-1/2 bg-slate-900 relative justify-center items-center overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-[#FF6B00] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-20"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>

        <div className="relative z-10 max-w-md text-white">
          <div className="mb-12">
             <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-orange-300 mb-6 uppercase tracking-wider">
                <Star size={12} className="fill-orange-300"/> Trusted by 500+ Clinics & Doctors
             </div>
             <h1 className="text-5xl font-black leading-tight mb-6">
                Turn Conversations <br/> into <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-400">Appointments.</span>
             </h1>
          </div>

          <div className="h-48 relative">
            <AnimatePresence mode='wait'>
              <motion.div 
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="bg-white/10 backdrop-blur-lg border border-white/10 p-8 rounded-3xl absolute inset-0"
              >
                 {slides[currentSlide].type === 'testimonial' ? (
                   <>
                     <div className="flex gap-1 text-yellow-400 mb-4">{[1,2,3,4,5].map(i => <Star key={i} size={16} className="fill-yellow-400"/>)}</div>
                     <p className="text-xl text-slate-100 italic mb-6 leading-relaxed">"{slides[currentSlide].text}"</p>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-red-500 flex items-center justify-center font-bold text-white text-sm">{slides[currentSlide].author?.[0] || 'D'}</div>
                        <div><div className="font-bold text-white text-sm">{slides[currentSlide].author}</div><div className="text-xs text-slate-400">{slides[currentSlide].role}</div></div>
                     </div>
                   </>
                 ) : (
                   <div className="flex flex-col justify-center h-full">
                      <div className="mb-4 text-[#FF6B00]"><CheckCircle2 size={32}/></div>
                      <p className="text-xl font-bold text-white leading-relaxed">{slides[currentSlide].text}</p>
                   </div>
                 )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex gap-2 mt-8 justify-center">
            {slides.map((_, index) => <div key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-[#FF6B00]' : 'w-2 bg-slate-700'}`}></div>)}
          </div>
        </div>
      </div>

      {/* 2. RIGHT SIDE: FORM SECTION */}
      <div className="w-full md:w-1/2 md:order-2 flex flex-col justify-center items-center p-8 relative bg-white">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px] lg:hidden"></div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md z-10">
          
          {/* Logo & Header */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-500/30">Y</div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Yogi Desk</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">{step === 1 ? "Welcome Back!" : "Enter Login Code"}</h2>
            <p className="text-gray-500">{step === 1 ? "Please enter your doctor credentials to access the system dashboard." : "Enter the secure 6-digit access code sent to your mobile device."}</p>
          </div>

          {/* 🔴 STEP 1: EMAIL & PASSWORD FORM */}
          {step === 1 && (
            <>
              <div id="recaptcha-container"></div>
              {/* Google Button */}
              <button type="button" onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition-all mb-6">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                Sign in with Google
              </button>

              <div className="relative flex py-2 items-center mb-6">
                <div className="flex-grow border-t border-gray-200"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-bold">Or continue with email</span>
                <div className="flex-grow border-t border-gray-200"></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" size={20} />
                    <input name="email" type="email" onChange={handleChange} placeholder="doctor@clinic.com" required className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 p-3.5 outline-none focus:border-[#FF6B00]"/>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between ml-1"><label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Password</label></div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" size={20} />
                    <input name="password" type={showPassword ? "text" : "password"} onChange={handleChange} placeholder="••••••••" required className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-12 p-3.5 outline-none focus:border-[#FF6B00]"/>
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Mobile Number</label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors" size={20} />
                    <input name="phone" type="tel" onChange={handleChange} placeholder="10-digit mobile number" required maxLength="10" className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 p-3.5 outline-none focus:border-[#FF6B00]"/>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-[#FF6B00] focus:ring-[#FF6B00] accent-[#FF6B00]" />
                    <span className="ml-2 text-sm text-gray-500 font-medium">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-sm font-bold text-[#FF6B00] hover:underline">Forgot Password?</Link>
                </div>

                <button disabled={loading} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-4 rounded-xl font-bold transition-all shadow-xl flex justify-center items-center gap-2 mt-4">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "Secure Login"} 
                  {!loading && <ArrowRight size={20}/>}
                </button>
              </form>
            </>
          )}

          {/* 🔴 STEP 2: OTP COMPONENT FALLBACK */}
          {step === 2 && (
            <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleSubmit} className="space-y-6">
               <div id="recaptcha-container"></div>
               <div className="flex gap-2 justify-center">
                  {otp.map((data, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={data}
                      onChange={e => handleOtpChange(e.target, index)}
                      onKeyDown={e => handleKeyDown(e, index)}
                      onFocus={e => e.target.select()}
                      className="w-12 h-14 border border-gray-300 rounded-xl text-center text-xl font-bold focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                    />
                  ))}
               </div>
               
               <button disabled={loading} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-4 rounded-xl font-bold transition-all shadow-xl flex justify-center items-center gap-2">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "Enter Login Code"} 
                  {!loading && <KeyRound size={20}/>}
               </button>

               <button type="button" onClick={() => setStep(1)} className="w-full text-sm text-gray-500 hover:text-gray-800 font-bold">
                 Return to Login Screen
               </button>
            </motion.form>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400 text-xs font-medium">
             <ShieldCheck size={14}/> Secure SSL Encryption
          </div>

          {step === 1 && (
            <p className="mt-4 text-center text-sm text-gray-500">
              Don't have an account yet?{' '}
              <Link to="/signup" className="font-bold text-[#FF6B00] hover:underline">Start with ₹50 Credits</Link>
            </p>
          )}
        </motion.div>
      </div>

    </div>
  );
};

export default Login;
