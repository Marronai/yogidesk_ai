import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabaseClient';
import {
  clearStoredAuthSession,
  getStoredAuthToken,
  getStoredUserEmail,
  getStoredUserId,
  persistSupabaseSession,
} from '../utils/authSession';

const AuthContext = createContext(null);

const userFromStoredSession = () => {
  const token = getStoredAuthToken();
  const storedUserId = getStoredUserId();
  const idFromToken = token?.startsWith('supabase-bypass-token-')
    ? token.replace('supabase-bypass-token-', '').trim()
    : '';
  const id = storedUserId || idFromToken;

  if (!token || !id) return null;

  return {
    id,
    email: getStoredUserEmail(),
    user_metadata: {
      name: localStorage.getItem('user_name') || 'Doctor',
      clinic_name: localStorage.getItem('clinic_name') || '',
      role: localStorage.getItem('user_role') || 'doctor',
    },
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const supabaseUser = data?.session?.user;

      if (supabaseUser?.id) {
        persistSupabaseSession(supabaseUser);
        setUser(supabaseUser);
        return supabaseUser;
      }

      const storedUser = userFromStoredSession();
      setUser(storedUser);
      return storedUser;
    } catch (error) {
      console.warn('Unable to restore auth session.', error?.message || error);
      const storedUser = userFromStoredSession();
      setUser(storedUser);
      return storedUser;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    clearStoredAuthSession();
    setUser(null);
    await supabase.auth.signOut().catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const restoredUser = await restoreSession();
      if (!active) return;
      setUser(restoredUser);
      setLoading(false);
    };

    bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user?.id) {
          persistSupabaseSession(session.user);
          setUser(session.user);
        }
        setLoading(false);
      }

      if (event === 'SIGNED_OUT') {
        const storedUser = userFromStoredSession();
        setUser(storedUser);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [restoreSession]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user?.id || getStoredAuthToken()),
    restoreSession,
    logout,
  }), [loading, logout, restoreSession, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
