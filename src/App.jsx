import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google'; // ✅ Import Provider

// Layouts & Guards
import MainLayout from './layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import DashboardHome from './pages/DashboardHome';
import LeadsCRM from './pages/LeadsCRM';
import Team from './pages/Team';
import Pricing from './pages/Pricing';
import Subscription from './pages/Subscription';
import LandingPage from './pages/LandingPage';
import Inbox from './pages/Inbox';
import AgentDashboard from './pages/AgentDashboard'; 
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Contacts from './pages/Contacts'; 
import PaymentStatus from './pages/PaymentStatus';
import Support from './pages/Support'; 
import Settings from './pages/MySettings'; 
import Campaigns from './pages/Campaigns'; 
import HospitalDischarge from './pages/HospitalDischarge';
import TemplateManager from './pages/TemplateManager';
import Templates from './pages/Templates';
import About from './pages/About';
import Contact from './pages/Contact';
import AuthSuccess from './pages/AuthSuccess';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import AdminDashboard from './pages/AdminDashboard';

const App = () => {
  // 🔑 Google Client ID ko environment variable se lo
  // Agar .env file load nahi hui to hardcoded string use karega (Backup)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

  return (
    // ✅ FIX: Puri App ko GoogleOAuthProvider se wrap kiya
    <GoogleOAuthProvider clientId={clientId}>
      <BrowserRouter>
        <Routes>
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />

          {/* ============================== */}
          {/* 1. PUBLIC ROUTES (Khule Routes)*/}
          {/* ============================== */}
          
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          <Route path="/auth-success" element={<AuthSuccess />} />  
          

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:resetToken" element={<ResetPassword />} />
          
          
          {/* ============================== */}
          {/* 2. PROTECTED ROUTES (Locked)   */}
          {/* ============================== */}
          {/* Ye check karega ki banda Logged In hai ya nahi */}
          <Route element={<ProtectedRoute />}>
              
              {/* ✅ Main Dashboard Wrapper */}
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<DashboardHome />} />
                <Route path="/dashboard/inbox" element={<Inbox />} />
                <Route path="/dashboard/contacts" element={<Contacts />} />
                <Route path="/dashboard/support" element={<Support />} />
                <Route path="/dashboard/settings" element={<Settings />} />
                <Route path="/dashboard/ads-crm" element={<LeadsCRM />} />
                <Route path="/dashboard/subscription" element={<Subscription />} />
                <Route path="/dashboard/agent-dashboard" element={<AgentDashboard />} />
                <Route path="/dashboard/admin" element={<AdminDashboard />} />
                <Route path="/templates" element={<TemplateManager />} />
                <Route path="/templates/create" element={<Templates />} />
              </Route>

              {/* ✅ Standalone Protected Tools (Bina Login ke nahi dikhenge) */}
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/hospital/discharge" element={<HospitalDischarge />} />
              <Route path="/team" element={<Team />} />
              <Route path="/payment-status" element={<PaymentStatus />} />

          </Route>

          {/* ============================== */}
          {/* 3. 404 / REDIRECTS             */}
          {/* ============================== */}
          
          {/* Agar kuch galat type kare toh wapas Landing Page par bhej do */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
};

export default App;
