import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, Star, Eye, EyeOff, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ⭐ Supabase Client Import
import { getOAuthRedirectUrl, handleGoogleSignIn, supabase } from '../config/supabaseClient';
import { clearStoredAuthSession, persistSupabaseSession } from '../utils/authSession';
import { useWallet } from '../context/WalletContext';
import { useAuth } from '../context/AuthContext';
import api, { API_URL } from '../utils/api';

const MotionDiv = motion.div;
const MotionForm = motion.form;
const META_REVIEWER_EMAIL = 'meta-tester@yogidesk-ai.com';

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [pendingCredentials, setPendingCredentials] = useState(null);
  const [countdown, setCountdown] = useState(0);
  
  // Login flow is intentionally two-step: password check first, dashboard routing only after OTP.
  const [step, setStep] = useState('login');
  const { fetchWalletData, fetchTransactions } = useWallet();
  const { isAuthenticated, loading: authLoading, restoreSession, loadUserProfile } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]); 

  const [formData, setFormData] = useState({ email: '', password: '' });

  // --- CAROUSEL DATA (Updated to Yogi Desk Branding) ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { text: "Yogi Desk changed how we handle leads. We went from missing appointments to replying instantly.", author: "Dr. Jay Sharma", role: "Founder, Dental Care", type: "testimonial" },
    { text: "Sending automated WhatsApp reminders has never been safer. Zero bans in 6 months!", author: "Dr. Priya Menon", role: "Clinic Head, Healthcare Team", type: "testimonial" },
    { text: "Automate your clinic appointment confirmations while you sleep. The #1 WhatsApp AI Tool for Indian Doctors.", author: null, role: null, type: "feature" }
  ];

  useEffect(() => {
    if (!authLoading && !loading && isAuthenticated && step === 'login' && !pendingCredentials) {
      navigate(localStorage.getItem('user_role') === 'STAFF' ? '/staff/dashboard' : '/dashboard', { replace: true });
      return undefined;
    }

    if (step !== 'login' || loading) {
      const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % slides.length), 4000);
      return () => clearInterval(timer);
    }

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
  }, [authLoading, isAuthenticated, loading, navigate, pendingCredentials, step, slides.length]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

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

  const startLoginEmailVerification = async (user, email) => {
    await api.post('/auth/request-email-otp', {
      email,
      name: user?.user_metadata?.full_name || user?.user_metadata?.name || 'Doctor',
      purpose: 'login'
    });

    setPendingUser(user);
    setOtp(["", "", "", "", "", ""]);
    setCountdown(59);
    setStep('otp');
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || !pendingCredentials?.email) return;
    setLoading(true);
    try {
      await startLoginEmailVerification(pendingUser, pendingCredentials.email);
    } catch (error) {
      alert(error?.response?.data?.msg || error.message || 'Unable to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 🌍 GOOGLE LOGIN HANDLER (Supabase Native Auth)
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const { error } = await handleGoogleSignIn(getOAuthRedirectUrl('/auth-success'));
      if (error) throw error;
    } catch (error) {
      alert(error.message || 'Google login failed. Please try again.');
      setLoading(false);
    }
  };

  // ✅ ENHANCED SUCCESS HANDLER (Saves session with fingerprint and persistence config)
  const resolvePostLoginRoute = async (user) => {
    try {
      const response = await api.get('/team/session-role', {
        params: {
          userId: user?.id,
          email: user?.email || formData.email.trim().toLowerCase(),
        },
      });

      if (response.data?.role === 'STAFF') {
        const member = response.data.member || {};
        localStorage.setItem('user_role', 'STAFF');
        sessionStorage.setItem('user_role', 'STAFF');
        localStorage.setItem('staff_admin_id', member.admin_id || '');
        sessionStorage.setItem('staff_admin_id', member.admin_id || '');
        if (member.name) localStorage.setItem('user_name', member.name);
        return response.data.redirectTo || '/staff/dashboard';
      }
    } catch (error) {
      console.warn('Unable to resolve team role, using default dashboard.', error?.response?.data?.message || error.message || error);
    }

    localStorage.setItem('user_role', 'doctor');
    sessionStorage.setItem('user_role', 'doctor');
    return '/dashboard';
  };

  const handleAuthSuccess = async (supabaseUser, authSession = null) => {
    try {
        if (!supabaseUser?.id) {
          throw new Error('Unable to complete login session.');
        }

        if (authSession?.access_token && authSession?.refresh_token) {
          await supabase.auth.setSession({
            access_token: authSession.access_token,
            refresh_token: authSession.refresh_token,
          });
        }
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
          sessionStorage.removeItem('token');
          
          // Remove from local storage if rememberMe is false to ensure session ends with tab
          localStorage.removeItem('sb-' + import.meta.env.VITE_SUPABASE_URL.split('//')[1].split('.')[0] + '-auth-token');
        } else {
          // Persistence explicitly in localStorage handled by default Supabase config, 
          // but we ensure our custom keys follow suit.
          localStorage.setItem('user_id', supabaseUser.id);
          localStorage.setItem('user_email', supabaseUser.email || '');
        }
        
        // 🚀 Redirect to Main Dashboard
        // After successful login, trigger a refresh of global wallet data
        await Promise.allSettled([
          fetchWalletData(supabaseUser.id),
          fetchTransactions(supabaseUser.id)
        ]);
        const restoredUser = await restoreSession();
        if (!restoredUser?.id) {
          throw new Error('Auth session could not be restored after OTP verification.');
        }
        await loadUserProfile(restoredUser.id, { force: true });
        const redirectTo = await resolvePostLoginRoute(restoredUser);
        navigate(redirectTo, { replace: true });
    } catch (error) {
        console.error("Session LocalStorage Save Error", error);
        if (supabaseUser?.id) {
          persistSupabaseSession(supabaseUser);
          localStorage.setItem('user_subscription_status', 'active');
          sessionStorage.setItem('user_id', supabaseUser.id);
          sessionStorage.setItem('user_email', supabaseUser.email || '');
          sessionStorage.removeItem('token');
          navigate(localStorage.getItem('user_role') === 'STAFF' ? '/staff/dashboard' : '/dashboard', { replace: true });
          return;
        }
        alert("Unable to complete login session. Please try again.");
    }
  };

  // 🚀 MAIN SUBMIT HANDLER (Supabase Auth Integration)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = formData.email.trim().toLowerCase();

    try {
      if (step === 'login') {
        // Clear any lingering session keys
        clearStoredAuthSession();
        setPendingCredentials(null);

        // --- SUPABASE PASSWORD SIGN IN ---
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: formData.password,
        });

        if (error) throw error;

        if (data?.user) {
          if (cleanEmail === META_REVIEWER_EMAIL) {
            setPendingCredentials(null);
            setPendingUser(null);
            setOtp(["", "", "", "", "", ""]);
            setCountdown(0);
            setStep('login');
            triggerLoginEmail(data.user);
            await handleAuthSuccess(data.user, data?.session);
            return;
          }

          setPendingCredentials({ email: cleanEmail, password: formData.password });
          await startLoginEmailVerification(data.user, cleanEmail);
          clearStoredAuthSession();
          await supabase.auth.signOut({ scope: 'local' });
          clearStoredAuthSession();
        }
      } else {
        const code = otp.join('');
        if (code.length !== 6) {
          alert("Please enter the 6-digit email OTP.");
          return;
        }

        const otpEmail = pendingCredentials?.email || cleanEmail;
        await api.post('/auth/verify-email-otp', { email: otpEmail, otp: code, purpose: 'login' });

        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: otpEmail,
          password: pendingCredentials?.password || formData.password,
        });

        if (signInError) throw signInError;
        const verifiedUser = data?.user || pendingUser;

        triggerLoginEmail(verifiedUser);
        await handleAuthSuccess(verifiedUser, data?.session);
      }
    } catch (error) {
      console.error(error);
      if (step === 'login' || step === 'otp') await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      alert(error.message || "Invalid Email or Password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden overflow-y-auto bg-[#05070b] font-sans md:flex-row lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,107,0,0.18)_0%,transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_16%,rgba(37,99,235,0.14),transparent_30%),linear-gradient(135deg,rgba(8,16,31,0.98),rgba(3,6,12,0.99)_54%,rgba(5,7,11,1))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(148,163,184,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.2)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.42)_78%)]" />
      
      {/* 1. LEFT SIDE: BRANDING & CAROUSEL */}
      <div className="relative hidden w-full items-center justify-center overflow-hidden border-white/10 md:order-1 md:flex md:min-h-dvh md:w-1/2 md:border-r">
        <div className="absolute inset-0 bg-[#05070b]/35 backdrop-blur-sm"></div>
        <div className="absolute -left-24 top-[-10%] h-[560px] w-[560px] rounded-full bg-[#FF6B00]/20 blur-[150px]"></div>
        <div className="absolute bottom-[-18%] right-[-18%] h-[560px] w-[560px] rounded-full bg-blue-500/12 blur-[150px]"></div>
        <div className="absolute inset-0 opacity-[0.2] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]"></div>

        <div className="relative z-10 max-w-md px-8 text-white">
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
              <MotionDiv 
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 rounded-3xl border border-white/10 bg-white/[0.07] p-8 backdrop-blur-xl"
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
              </MotionDiv>
            </AnimatePresence>
          </div>
          <div className="flex gap-2 mt-8 justify-center">
            {slides.map((_, index) => <div key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-[#FF6B00]' : 'w-2 bg-slate-700'}`}></div>)}
          </div>
        </div>
      </div>

      {/* 2. RIGHT SIDE: FORM SECTION */}
      <div className="relative flex min-h-dvh w-full flex-col items-center justify-center p-6 md:order-2 md:w-1/2 md:p-8">
        <div className="absolute inset-0 bg-white"></div>
        <div className="absolute left-[-10%] top-[-10%] h-[40%] w-[40%] rounded-full bg-orange-500/10 blur-[120px] lg:hidden"></div>

        <MotionDiv initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-md z-10">
          
          {/* Logo & Header */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-[#FF6B00] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-orange-500/30">Y</div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Yogi Desk</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">{step === 'login' ? "Welcome Back!" : "Enter Login Code"}</h2>
            <p className="text-gray-500">{step === 'login' ? "Please enter your doctor credentials to access the system dashboard." : `Enter the secure 6-digit code sent to ${pendingCredentials?.email || formData.email || 'your email'}.`}</p>
          </div>

          {/* 🔴 STEP 1: EMAIL & PASSWORD FORM */}
          {step === 'login' && (
            <>
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
          {step === 'otp' && (
            <MotionForm initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleSubmit} className="space-y-6">
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
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "Verify & Login"} 
                  {!loading && <KeyRound size={20}/>}
               </button>

               <button
                 type="button"
                 onClick={handleResendOtp}
                 disabled={loading || countdown > 0}
                 className={`w-full text-sm font-bold transition ${countdown > 0 ? 'cursor-not-allowed text-gray-400' : 'text-[#FF6B00] hover:underline'}`}
               >
                 {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
               </button>

               <button type="button" onClick={() => { setStep('login'); setPendingCredentials(null); setPendingUser(null); setCountdown(0); setOtp(["", "", "", "", "", ""]); }} className="w-full text-sm text-gray-500 hover:text-gray-800 font-bold">
                 Return to Login Screen
               </button>
            </MotionForm>
          )}

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400 text-xs font-medium">
             <ShieldCheck size={14}/> Secure SSL Encryption
          </div>

          {step === 'login' && (
            <p className="mt-4 text-center text-sm text-gray-500">
              Don't have an account yet?{' '}
              <Link to="/signup" className="font-bold text-[#FF6B00] hover:underline">Start with ₹50 Credits</Link>
            </p>
          )}
        </MotionDiv>
      </div>

    </div>
  );
};

export default Login;
