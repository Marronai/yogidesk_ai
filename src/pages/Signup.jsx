import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { jwtDecode } from "jwt-decode";
import { 
  User, Building, Mail, Lock, Phone, ArrowRight, Loader2, 
  Briefcase, CheckCircle, Star, AlertCircle, Eye, EyeOff // ✅ Added Eye Icons
} from 'lucide-react';
import { motion } from 'framer-motion';

const Signup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // ✅ Password Visibility State

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '', 
    password: '',
    businessType: 'Retail'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGoogleSignup = async () => {
    alert("Google Sign-up feature will be connected to backend via OAuth.");
  };

  const validateForm = () => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/;
    if (!passwordRegex.test(formData.password)) {
      alert("Security Alert: Password must be 8-16 chars long and include:\n- One Uppercase Letter (A-Z)\n- One Lowercase Letter (a-z)\n- One Number (0-9)\n- One Special Character (@$!%*?&)");
      return false;
    }
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      alert("Please enter a valid 10-digit mobile number.");
      return false;
    }
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!nameRegex.test(formData.name)) {
        alert("Name should only contain alphabets.");
        return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const cleanData = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        businessName: formData.businessName.trim()
      };

      const res = await axios.post(`${API_URL}/auth/register`, cleanData);
      
      if (res.data.token) {
        const decoded = jwtDecode(res.data.token);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user_role', decoded.role);
        localStorage.setItem('user_name', decoded.name || cleanData.name);
        alert("Account Created Successfully! 🎉");
        navigate('/'); 
      }
    } catch (error) {
      const msg = error.response?.data?.msg || "Signup Failed. Please try again.";
      alert(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-white font-sans overflow-hidden">
      
      {/* 1. LEFT SIDE: BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative justify-center items-center overflow-hidden p-12">
        <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-[#FF6B00] rounded-full blur-[150px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px] opacity-20"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>

        <motion.div 
          initial={{ opacity: 0, x: -30 }} 
          animate={{ opacity: 1, x: 0 }} 
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-lg text-white"
        >
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-orange-300 mb-8 uppercase tracking-wider">
             <Star size={12} className="fill-orange-300"/> Join 10,000+ Businesses
          </div>
          <h1 className="text-5xl font-black leading-tight mb-6">
             Start Growing <br/> with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-orange-400">Automation.</span>
          </h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
             Create your free account today and start automating your WhatsApp sales in minutes. No credit card required.
          </p>
          <ul className="space-y-5">
             {['Anti-Ban Technology Included', 'Admin Ghost Mode Access', 'Industry Specific CRM'].map((item, i) => (
                <motion.li 
                  key={i} 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: 0.2 + (i * 0.1) }}
                  className="flex items-center gap-3 text-lg font-medium text-slate-200"
                >
                   <div className="bg-[#FF6B00]/20 p-1 rounded-full"><CheckCircle size={20} className="text-[#FF6B00]"/></div> 
                   {item}
                </motion.li>
             ))}
          </ul>
        </motion.div>
      </div>

      {/* 2. RIGHT SIDE: SIGNUP FORM */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 lg:p-12 relative bg-white overflow-y-auto">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-500/10 rounded-full blur-[120px] lg:hidden"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.6 }}
          className="w-full max-w-md z-10 py-10"
        >
          <div className="mb-8">
             <h2 className="text-3xl font-black text-gray-900 mb-2">Create Account 🚀</h2>
             <p className="text-gray-500">Get started with your 14-day free trial.</p>
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignup}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all mb-6 group"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" />
            Sign up with Google
          </button>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase font-bold">Or register with email</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="relative">
                  <User size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                  <input name="name" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition" placeholder="Full Name" required/>
               </div>
               <div className="relative">
                  <Building size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                  <input name="businessName" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition" placeholder="Company Name" required/>
               </div>
            </div>

            <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                <input name="email" type="email" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition" placeholder="Email Address" required/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="relative">
                  <Phone size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                  <input name="phone" type="tel" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition" placeholder="Mobile No" required/>
               </div>
               <div className="relative">
                  <Briefcase size={18} className="absolute left-3.5 top-3.5 text-gray-400"/>
                  <select name="businessType" onChange={handleChange} className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 p-3 outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition appearance-none cursor-pointer text-gray-700">
                     <option value="Retail">Retail / E-com</option>
                     <option value="Hospital">Hospital</option>
                     <option value="RealEstate">Real Estate</option>
                     <option value="Education">Education</option>
                     <option value="Agency">Agency</option>
                     <option value="Other">Other</option>
                  </select>
               </div>
            </div>

            {/* ✅ FIXED: Password Input with Eye Icon */}
            <div className="relative group">
                <Lock size={18} className="absolute left-3.5 top-3.5 text-gray-400 group-focus-within:text-[#FF6B00] transition-colors"/>
                <input 
                  name="password" 
                  type={showPassword ? "text" : "password"} 
                  onChange={handleChange} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-12 p-3 outline-none focus:border-[#FF6B00] focus:ring-1 focus:ring-[#FF6B00] transition" 
                  placeholder="Password" 
                  required
                />
                
                {/* 👁️ Toggle Button */}
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>

                {/* ℹ️ Helper text */}
                <div className="mt-2 flex items-start gap-2 text-[10px] text-gray-400 bg-gray-50 p-2 rounded-lg border border-gray-100">
                   <AlertCircle size={12} className="mt-0.5 text-orange-500 shrink-0"/>
                   <span>Must be 8-16 chars, include Uppercase, Lowercase, Number & Symbol (@$!%*?&)</span>
                </div>
            </div>

            <button disabled={loading} className="w-full bg-[#FF6B00] hover:bg-orange-600 text-white py-3.5 rounded-xl font-bold transition shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 flex justify-center items-center gap-2 transform active:scale-[0.98] mt-6">
              {loading ? <Loader2 size={20} className="animate-spin" /> : "Create Free Account"} 
              {!loading && <ArrowRight size={20}/>}
            </button>
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