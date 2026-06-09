import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';

const ProtectedRoute = () => {
  const { isAuthenticated, loading, hasLegacyStoredSession } = useAuth();

  if (loading || (!isAuthenticated && hasLegacyStoredSession)) {
    return <AuthLoadingScreen />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
