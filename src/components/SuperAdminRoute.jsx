import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { Loader2 } from 'lucide-react';

const SuperAdminRoute = () => {
  const [auth, setAuth] = useState({ loading: true, isSuperAdmin: false });

  useEffect(() => {
    const checkRole = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user) {
          return setAuth({ loading: false, isSuperAdmin: false });
        }

        const { data: profile, error: profileError } = await supabase
          .from('doctor_profiles')
          .select('user_role, role')
          .eq('id', user.id)
          .maybeSingle();

        const roleValue = String(profile?.user_role || profile?.role || user?.user_metadata?.role || user?.role || '').toUpperCase();
        const isSuper = roleValue === 'SUPER_ADMIN';
        if (profileError) {
          console.warn('Unable to validate super admin profile:', profileError.message || profileError);
        }

        setAuth({ loading: false, isSuperAdmin: !!isSuper });
      } catch {
        console.error('Super admin route validation failed.');
        setAuth({ loading: false, isSuperAdmin: false });
      }
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