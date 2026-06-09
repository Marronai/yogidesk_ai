import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoadingScreen from './AuthLoadingScreen';
import HiddenNotFound from './superadmin/HiddenNotFound';

const SuperAdminRoute = () => {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth();

  if (loading) return <AuthLoadingScreen tone="dark" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return isSuperAdmin ? <Outlet /> : <HiddenNotFound />;
};

export default SuperAdminRoute;
