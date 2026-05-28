import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// Layouts & Guards
import MainLayout from './layout/MainLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import DashboardHome from './pages/DashboardHome';
import LeadsCRM from './pages/LeadsCRM';
import Team from './pages/Team';
import Pricing from './pages/Pricing';
import Subscription from './pages/Subscription';
import YogiWallet from './pages/YogiWallet';
import LandingPage from './pages/LandingPage';
import Inbox from './pages/Inbox';
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
import AcceptInvite from './pages/AcceptInvite';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import AdminDashboard from './admin/AdminDashboard';
import AdminLogin from './admin/AdminLogin';
import AdminPrivateRoute from './admin/AdminPrivateRoute';
import TermsConditions from './pages/TermsConditions';
import Footer from './components/Footer';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminRoute from './components/SuperAdminRoute';
import { WalletProvider } from './context/WalletContext';
import { AuthProvider } from './context/AuthContext';
 // Agar navbar bhi global hai


const AppContent = () => {
  const location = useLocation();
  
  // Comprehensive internal route exclusion array
  const internalDashboardPaths = ['/login', '/signup', '/dashboard', '/templates', '/settings', '/campaigns', '/yogi-core-control-center'];
  
  // Check if current URL starts with any internal application route
  const isInternalRoute = internalDashboardPaths.some(path => location.pathname.startsWith(path));

  return (
      <>
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
          <Route path="/terms" element={<TermsConditions />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          
          <Route path="/auth-success" element={<AuthSuccess />} />  
          

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:resetToken" element={<ResetPassword />} />
          

          {/* Admin Portal Routes */}
          <Route element={<AdminPrivateRoute />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
          
          
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
                <Route path="/dashboard/wallet" element={<YogiWallet />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/templates" element={<TemplateManager />} />
                <Route path="/team" element={<Team />} />
                {/* Route for the creation builder */}
                <Route path="/templates/create" element={<Templates />} />
              </Route>

              {/* ✅ Standalone Protected Tools (Bina Login ke nahi dikhenge) */}
              <Route path="/hospital/discharge" element={<HospitalDischarge />} />
              <Route path="/payment-status" element={<PaymentStatus />} />

          </Route>

          {/* ============================== */}
          {/* 4. SUPER ADMIN (HIDDEN)        */}
          {/* ============================== */}
          <Route element={<SuperAdminRoute />}>
            <Route path="/yogi-core-control-center" element={<SuperAdminDashboard />} />
          </Route>

          {/* ============================== */}
          {/* 3. 404 / REDIRECTS             */}
          {/* ============================== */}
          
          {/* Agar kuch galat type kare toh wapas Landing Page par bhej do */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {/* Render footer ONLY on public marketing pages */}
        {!isInternalRoute && <Footer />}
      </>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WalletProvider>
          <AppContent />
        </WalletProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
