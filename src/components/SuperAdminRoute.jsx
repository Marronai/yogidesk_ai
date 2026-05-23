import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { Loader2 } from 'lucide-react';

const SuperAdminRoute = () => {
  const [auth, setAuth] = useState({ loading: true, isSuperAdmin: false });

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // Check metadata or custom claims for the super_admin role
      const isSuper = user?.user_metadata?.role === 'super_admin' || user?.role === 'super_admin';
      setAuth({ loading: false, isSuperAdmin: !!isSuper });
    };
    checkRole();
  }, []);

  if (auth.loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-900">
      <Loader2 className="animate-spin text-orange-500" size={48} />
    </div>
  );

  return auth.isSuperAdmin ? <Outlet /> : <Navigate to="/dashboard" replace />;
};

export default SuperAdminRoute;