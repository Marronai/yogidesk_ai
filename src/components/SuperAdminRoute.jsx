import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { Loader2 } from 'lucide-react';
import HiddenNotFound from './superadmin/HiddenNotFound';

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

        const isSuper = String(user?.user_metadata?.role || '').trim() === 'superadmin';
        setAuth({ loading: false, isSuperAdmin: isSuper });
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

  return auth.isSuperAdmin ? <Outlet /> : <HiddenNotFound />;
};

export default SuperAdminRoute;
