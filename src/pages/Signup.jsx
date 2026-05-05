import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { 
  User, Building, Mail, Lock, Phone, ArrowRight, Loader2, 
  Star, CheckCircle, Eye, EyeOff, Briefcase 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useGoogleLogin } from '@react-oauth/google';

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Signup Steps State (1 = Details, 2 = OTP)
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  // Backend URL
  const API_URL = import.meta.env.VITE_API_URL || 'https://yogidesk-ai.com/api';

  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    password: '',
    businessType: 'Retail',
    businessCategory: 'Other'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 🔢 OTP INPUT HANDLER (Improved)
  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return false;
    
    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Auto focus next input
    if (element.value && element.nextSibling) {
      element.nextSibling.focus();
    }
  };

  // 🔙 BACKSPACE HANDLER (New UX Fix)
  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (!otp[index] && e.target.previousSibling) {
        e.target.previousSibling.focus();
      }
    }
  };

  // ✅ HELPER: Login success hone par data save karo aur Dashboard bhejo
  const handleAuthSuccess = (data) => {
    try {
      if (data.token) {
        const decoded = jwtDecode(data.token);
        localStorage.setItem('token', data.token);
        localStorage.setItem('user_id', decoded.id);
        localStorage.setItem('user_role', decoded.role || 'trial_user');
        localStorage.setItem('user_name', decoded.name || formData.name || 'User');
        
        // 🚀 Seedha Dashboard!
        navigate('/dashboard');
      }
    } catch (error) {
      console.error("Token Save Error", error);
    }
  };

  // Google Login Logic
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        setLoading(true);
        const res = await axios.post(`${API_URL}/auth/google`, {
          tokenId: tokenResponse.access_token
        });
        handleAuthSuccess(res.data);
      } catch (err) {
        alert(err.response?.data?.msg || "Google Signup Failed");
      } finally {
        setLoading(false);
      }
    },
    onError: () => alert("Google Signup Failed"),
  });

  // Manual Signup Logic
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (step === 1) {
        // --- STEP 1: REGISTER & SEND OTP ---
        const cleanData = {
          ...formData,
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.replace(/\D/g, '').slice(-10) // Clean phone to 10 digits
        };

        // Validate phone number
        if (cleanData.phone && cleanData.phone.length !== 10) {
          alert("Please enter a valid 10-digit phone number");
          setLoading(false);
          return;
        }

        const res = await axios.post(`${API_URL}/auth/register`, cleanData);
        
        if (res.data.success) {
          setStep(2); // Move to OTP Screen
          // OTP fill karne ke liye array reset karo
          setOtp(["", "", "", "", "", ""]);
          // User friendly message
          alert(`OTP Sent to ${formData.email}`);
        }
      } else {
        // --- STEP 2: VERIFY OTP ---
        const finalOtp = otp.join("");
        
        const res = await axios.post(`${API_URL}/auth/verify-signup-otp`, { 
          email: formData.email, 
          otp: finalOtp 
        });

        handleAuthSuccess(res.data);
      }
    } catch (error) {
      alert(error.response?.data?.msg || "Signup Failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      
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
             <Star size={12} className="fill-orange-300"/> Join 10,000+ Businesses
          </div>
          <h1 className="text-5xl font-black leading-tight mb-6">
             Start Growing <br/> with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-400">Automation.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
             Direct dashboard access enabled. No OTP required for testing.
          </p>
          <ul className="space-y-5">
             {['Instant Dashboard Access', 'Admin Features Unlocked', 'WhatsApp API Ready'].map((item, i) => (
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
               {step === 1 ? "Create Account 🚀" : "Verify Your Email"}
             </h2>
             <p className="text-gray-500">
               {step === 1 ? "Sign up and jump straight into the dashboard." : `We've sent a 6-digit code to ${formData.email}`}
             </p>
          </div>

          <button 
            type="button"
            onClick={() => handleGoogleLogin()}
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
                       <input name="businessName" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00]" placeholder="Company" required/>
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
                      <option value="Hospital">Hospital</option>
                      <option value="Clinic">Clinic</option>
                      <option value="Coaching">Coaching</option>
                      <option value="Salon">Salon</option>
                      <option value="Other">Other</option>
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
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "Send Verification Code"} 
                  {!loading && <ArrowRight size={20}/>}
                </button>
              </>
            ) : (
              <>
                {/* OTP Input Fields */}
                <div className="flex justify-center gap-2 mb-6">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target, index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="w-12 h-12 text-center text-2xl font-bold bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-[#FF6B00] focus:outline-none transition-colors"
                      ref={(ref) => {
                        if (ref && index === 0 && otp.every(d => d === "")) ref.focus();
                      }}
                    />
                  ))}
                </div>

                <button disabled={loading || otp.some(d => d === "")} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition flex justify-center items-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <Loader2 size={20} className="animate-spin" /> : "Verify & Create Account"} 
                  {!loading && <ArrowRight size={20}/>}
                </button>

                <button 
                  type="button" 
                  onClick={() => setStep(1)} 
                  className="w-full text-gray-500 py-2 rounded-xl font-medium transition hover:text-gray-700"
                >
                  ← Back to Details
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