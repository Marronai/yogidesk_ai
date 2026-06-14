import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import AuthLoadingScreen from './AuthLoadingScreen';

const getSuperadminRole = (user, profile) => String(
  user?.app_metadata?.role ||
  user?.app_metadata?.user_role ||
  user?.app_metadata?.account_role ||
  user?.user_metadata?.role ||
  user?.user_metadata?.user_role ||
  user?.user_metadata?.account_role ||
  profile?.custom_profile?.role ||
  profile?.custom_profile?.user_role ||
  profile?.user_role ||
  profile?.role ||
  ''
).trim().toLowerCase();

const SuperAdminRoute = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, user, userProfile } = useAuth();
  const [roleCheck, setRoleCheck] = useState({ loading: true, allowed: null });

  const contextRole = useMemo(() => getSuperadminRole(user, userProfile), [user, userProfile]);

  useEffect(() => {
    let active = true;

    const verifySuperadminRole = async () => {
      if (loading) {
        setRoleCheck({ loading: true, allowed: null });
        return;
      }

      if (!isAuthenticated) {
        setRoleCheck({ loading: false, allowed: false });
        navigate('/login', { replace: true });
        return;
      }

      try {
        const { data } = await supabase.auth.getUser();
        const activeUser = data?.user || user;
        console.log('Active Superadmin Meta Data:', activeUser);

        const role = getSuperadminRole(activeUser, userProfile) || contextRole;
        let allowed = role === 'superadmin';

        if (!allowed) {
          const { data: superadminContext } = await api.get('/superadmin/me');
          allowed = ['superadmin', 'superadmin_staff'].includes(superadminContext?.user?.role);
        }

        if (!active) return;
        setRoleCheck({ loading: false, allowed });

        if (!allowed) {
          navigate('/superadmin/login', { replace: true });
        }
      } catch (error) {
        console.warn('Superadmin role verification failed.', error?.message || error);
        if (!active) return;
        setRoleCheck({ loading: false, allowed: false });
        navigate('/superadmin/login', { replace: true });
      }
    };

    verifySuperadminRole();
    return () => { active = false; };
  }, [contextRole, isAuthenticated, loading, navigate, user, userProfile]);

  if (loading || roleCheck.loading) return <AuthLoadingScreen tone="dark" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return roleCheck.allowed === true ? <Outlet /> : <AuthLoadingScreen tone="dark" />;
};

export default SuperAdminRoute;
