import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Check karein ki user ke paas token hai ya nahi
  // (Yeh wahi key honi chahiye jo Login.jsx me set ki thi)
  const isAuthenticated = localStorage.getItem('token'); 

  // Agar token hai to Dashboard dikhao (Outlet), nahi to Login par bhejo
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;