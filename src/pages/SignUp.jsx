import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  User, Building, Mail, Lock, Phone, ArrowRight, Loader2, 
  Star, CheckCircle, Eye, EyeOff, Briefcase 
} from 'lucide-react';
import * as FramerMotion from 'framer-motion';
import { getOAuthRedirectUrl, handleGoogleSignIn, supabase } from '../config/supabaseClient';

// ⭐ Supabase Client Import (Aapne jo file banayi thi)
import { persistSupabaseSession } from '../utils/authSession';
import api from '../utils/api';
import AuthLoadingScreen from '../components/AuthLoadingScreen';

const getMissingColumnName = (error) => {
  const message = String(error?.message || error?.details || '');
  const match = message.match(/'([^']+)' column/i) || message.match(/column "?([a-zA-Z0-9_]+)"?/i);
  return match?.[1] || '';
};

const upsertProfileSafely = async (payload) => {
  let safePayload = { ...payload };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { error } = await supabase
      .from('doctor_profiles')
      .upsert(safePayload, { onConflict: 'id' });

    if (!error) return { error: null };
    const missingColumn = getMissingColumnName(error);
    if (!missingColumn || !Object.prototype.hasOwnProperty.call(safePayload, missingColumn)) return { error };
    const { [missingColumn]: _removed, ...nextPayload } = safePayload;
    safePayload = nextPayload;
  }

  return { error: new Error('Profile seed retry limit reached.') };
};

const SignUp = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingUser, setPendingUser] = useState(null);
  const [smsOtp, setSmsOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(0);

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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      const user = data?.session?.user;
      if (!mounted || !user) return;
      setPendingUser(user);
      if (user.app_metadata?.provider === 'google') setStep(4);
      setFormData((prev) => ({
        ...prev,
        name: prev.name || user.user_metadata?.full_name || user.user_metadata?.name || '',
        email: prev.email || user.email || '',
      }));
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const handleSmsOtpChange = (element, index) => {
    if (isNaN(element.value)) return;
    const nextOtp = [...smsOtp];
    nextOtp[index] = element.value;
    setSmsOtp(nextOtp);
    if (element.value && element.nextSibling) element.nextSibling.focus();
  };

  const ensureSignupWallet = async (userId) => {
    if (!userId) return;

    const walletPayload = {
      user_id: userId,
      balance: 50.00,
      is_first_recharge: true,
      welcome_gift_active: true,
      current_plan: 'growth',
      plan_tier: 'growth',
      lifetime_contacts_count: 0,
    };
    const walletConflictTarget = 'user_id';

    const { error } = await supabase
      .from('wallets')
      .upsert(walletPayload, { onConflict: walletConflictTarget });

    if (error) console.warn('Wallet database seed deferred:', error.message);

  };

  const ensurePremiumTrialProfile = async (userId, email = formData.email) => {
    if (!userId) return;

    const now = new Date();
    const trialEndAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const profilePayload = {
      id: userId,
      email: email.trim().toLowerCase(),
      name: formData.name.trim() || 'Doctor',
      clinic_name: formData.businessName.trim(),
      business_category: formData.businessCategory,
      clinic_category: formData.businessCategory,
      specialization: formData.businessCategory,
      phone_number: formData.phone.replace(/\D/g, '').slice(-10),
      subscription_tier: 'growth',
      current_plan: 'growth',
      plan_tier: 'growth',
      subscription_status: 'trialing',
      trial_start_at: now.toISOString(),
      trial_end_at: trialEndAt.toISOString(),
      wallet_balance: 50.00,
      lifetime_patients_limit: 2000,
      ai_message_balance: 500,
      ai_token_balance: 500,
      onboarding_tour_completed: false,
      plan_limits: { patient_limit: 2000, staff_limit: 2, template_limit: 50 },
      updated_at: now.toISOString(),
    };

    const { error } = await upsertProfileSafely(profilePayload);

    if (error) console.warn('Premium trial profile seed deferred to backend.');
  };

  const triggerWelcomeEmail = (email = formData.email, userId = pendingUser?.id) => {
    const payload = {
      email: email.trim().toLowerCase(),
      name: formData.name.trim(),
      businessName: formData.businessName.trim(),
      businessCategory: formData.businessCategory,
      phone: formData.phone.replace(/\D/g, '').slice(-10),
      userId,
      template: 'welcome'
    };

    const body = JSON.stringify(payload);
    const url = `${api.defaults.baseURL}/auth/dispatch-welcome-email`;

    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) {
      return;
    }

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  };

  const startSignupEmailVerification = async (user, email = formData.email) => {
    await api.post('/auth/request-email-otp', {
      email: email.trim().toLowerCase(),
      name: formData.name.trim() || user?.user_metadata?.full_name || 'Doctor',
      purpose: 'signup',
    });
    setPendingUser(user || null);
    setSmsOtp(["", "", "", "", "", ""]);
    setCountdown(59);
    setStep(3);
  };

  const handleResendSignupOtp = async () => {
    if (countdown > 0) return;
    const email = (pendingUser?.email || formData.email || '').trim().toLowerCase();
    if (!email) return;
    setLoading(true);
    try {
      await startSignupEmailVerification(pendingUser, email);
    } catch (error) {
      alert(error?.response?.data?.msg || error.message || 'Unable to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ HELPER: LocalStorage token configuration dashboard navigation ke liye
  const handleAuthSuccess = (supabaseUser) => {
    try {
      if (supabaseUser) {
        persistSupabaseSession(supabaseUser, {
          name: formData.name,
          businessName: formData.businessName,
          clinicName: formData.businessName,
          businessCategory: formData.businessCategory,
          phone: formData.phone,
          plan: 'growth',
          plan_tier: 'growth',
          specialization: formData.businessCategory,
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
      setStep(4);
      sessionStorage.setItem('yogidesk_google_auth_flow', 'signup');
      localStorage.setItem('yogidesk_google_auth_flow', 'signup');
      const { error } = await handleGoogleSignIn(getOAuthRedirectUrl('/auth-success?flow=signup'));
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
        await startSignupEmailVerification(null, cleanEmail);
        alert(`OTP sent to ${cleanEmail}. Enter the email OTP to finish activation.`);
      } else if (step === 4) {
        const { data: sessionData } = await supabase.auth.getSession();
        const googleUser = sessionData?.session?.user || pendingUser;
        if (!googleUser?.id) {
          alert("Please complete Google authentication first.");
          return;
        }

        await supabase.auth.updateUser({
          data: {
            full_name: formData.name.trim() || googleUser.user_metadata?.full_name || 'Doctor',
            business_name: formData.businessName.trim(),
            business_category: formData.businessCategory,
            specialization: formData.businessCategory,
            plan_tier: 'growth',
            phone: cleanPhone
          }
        });
        await startSignupEmailVerification({
          ...googleUser,
          user_metadata: {
            ...(googleUser.user_metadata || {}),
            full_name: formData.name.trim() || googleUser.user_metadata?.full_name,
            business_name: formData.businessName.trim(),
            business_category: formData.businessCategory,
            specialization: formData.businessCategory,
            plan_tier: 'growth',
            phone: cleanPhone
          }
        }, googleUser.email || cleanEmail);
      } else if (step === 3) {
        const code = smsOtp.join('');
        const otpEmail = (pendingUser?.email || cleanEmail || formData.email).trim().toLowerCase();
        if (code.length !== 6) {
          alert("Please enter the 6-digit email OTP.");
          return;
        }

        await api.post('/auth/verify-email-otp', { email: otpEmail, otp: code, purpose: 'signup' });

        if (pendingUser?.id) {
          await ensureSignupWallet(pendingUser.id);
          await ensurePremiumTrialProfile(pendingUser.id, otpEmail);
          triggerWelcomeEmail(otpEmail, pendingUser.id);
          handleAuthSuccess(pendingUser);
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name.trim(),
              business_name: formData.businessName.trim(),
              business_category: formData.businessCategory,
              specialization: formData.businessCategory,
              plan_tier: 'growth',
              phone: cleanPhone,
              email_otp_verified: true
            }
          }
        });

        if (error) throw error;

        const verifiedUser = data?.session?.user || data?.user;
        if (verifiedUser?.id) {
          await ensureSignupWallet(verifiedUser.id);
          await ensurePremiumTrialProfile(verifiedUser.id, cleanEmail);
          triggerWelcomeEmail(cleanEmail, verifiedUser.id);
        }

        if (data?.session?.user) {
          handleAuthSuccess(data.session.user);
          return;
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: formData.password,
        });

        if (signInError || !signInData?.user) {
          setStep(2);
          alert(`Email OTP verified. Please login with ${cleanEmail}.`);
          return;
        }

        handleAuthSuccess(signInData.user);
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
      {loading && (
        <AuthLoadingScreen
          message={step === 3 ? 'Verifying your clinic signup code...' : 'Preparing your YogiDesk clinic workspace...'}
        />
      )}
      
      {/* LEFT SIDE: BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative justify-center items-center overflow-hidden p-12">
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-[#FF6B00] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-20"></div>

        <FramerMotion.motion.div 
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
        </FramerMotion.motion.div>
      </div>

      {/* RIGHT SIDE: SIGNUP FORM */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 lg:p-12 bg-white overflow-y-auto">
        <FramerMotion.motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-md z-10 py-10"
        >
          <div className="mb-8 text-center lg:text-left">
             <h2 className="text-3xl font-black text-gray-900 mb-2">
               {step === 1 ? "Create your Yogi Desk account" : "Activate your account"}
             </h2>
             <p className="text-gray-500">
               {step === 1 ? "Create your clinic workspace and receive Rs. 50 WhatsApp credits." : step === 3 ? `Enter the secure OTP code sent to ${(pendingUser?.email || formData.email || 'your email')}.` : "Complete your clinic details to continue."}
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
            {step === 1 || step === 4 ? (
              <>
                {step === 4 && (
                  <div className="text-center p-4 bg-orange-50 border border-orange-100 rounded-xl">
                    <p className="text-sm text-orange-700 font-medium">
                      Complete clinic details, then verify your email OTP.
                    </p>
                  </div>
                )}
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

                {step === 1 && (
                <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input name="email" type="email" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" placeholder="Email Address" required/>
                </div>
                )}

                <div className="relative">
                    <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                    <input 
                      name="phone" 
                      type="tel" 
                      onChange={handleChange} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" 
                      placeholder="Phone Number (10 digits)" 
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

                {step === 1 && (
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
                )}

                <button disabled={loading} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-6">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : step === 4 ? "Send OTP" : "Create Yogi Desk Account"} 
                  {!loading && <ArrowRight size={20}/>}
                </button>
              </>
            ) : step === 3 ? (
              <>
                <div className="text-center p-6 bg-orange-50 border border-orange-100 rounded-xl mb-4">
                   <p className="text-sm text-orange-700 font-medium">
                     Enter the secure OTP code sent to your email.
                   </p>
                </div>

                <div className="flex gap-2 justify-center">
                  {smsOtp.map((value, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={value}
                      onChange={(event) => handleSmsOtpChange(event.target, index)}
                      onFocus={(event) => event.target.select()}
                      className="w-12 h-14 border border-gray-300 rounded-xl text-center text-xl font-bold focus:border-[#FF6B00] focus:ring-2 focus:ring-orange-100 outline-none transition-all"
                    />
                  ))}
                </div>

                <button disabled={loading} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-4">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "Verify OTP"} 
                  {!loading && <ArrowRight size={20}/>}
                </button>

                <button
                  type="button"
                  onClick={handleResendSignupOtp}
                  disabled={loading || countdown > 0}
                  className={`w-full py-2 rounded-xl font-bold transition ${countdown > 0 ? 'cursor-not-allowed text-gray-400' : 'text-[#FF6B00] hover:underline'}`}
                >
                  {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
                </button>

                <button 
                  type="button" 
                  onClick={() => { setCountdown(0); setStep(1); }} 
                  className="w-full text-gray-500 py-2 rounded-xl font-medium transition hover:text-gray-700"
                >
                  Back to Edit Details
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
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[#FF6B00] hover:underline">
              Login
            </Link>
          </p>
        </FramerMotion.motion.div>
      </div>
    </div>
  );
};

export default SignUp;
