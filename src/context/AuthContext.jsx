import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../config/supabaseClient';
import {
  clearStoredAuthSession,
  getStoredAuthToken,
  getStoredUserEmail,
  getStoredUserId,
  persistSupabaseSession,
} from '../utils/authSession';
import api from '../utils/api';

const AuthContext = createContext(null);
const PROFILE_SNAPSHOT_KEY = 'yogidesk_user_profile_snapshot';

const readProfileSnapshot = () => {
  try {
    const raw = localStorage.getItem(PROFILE_SNAPSHOT_KEY) || sessionStorage.getItem(PROFILE_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeProfileSnapshot = (profile) => {
  if (!profile || typeof profile !== 'object') return;
  const serialized = JSON.stringify(profile);
  localStorage.setItem(PROFILE_SNAPSHOT_KEY, serialized);
  sessionStorage.setItem(PROFILE_SNAPSHOT_KEY, serialized);
};

const clearProfileSnapshot = () => {
  localStorage.removeItem(PROFILE_SNAPSHOT_KEY);
  sessionStorage.removeItem(PROFILE_SNAPSHOT_KEY);
};

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
  const [userProfile, setUserProfile] = useState(() => readProfileSnapshot());
  const [loading, setLoading] = useState(true);

  const loadUserProfile = useCallback(async (userId, { force = false } = {}) => {
    if (!userId) return null;

    const existing = readProfileSnapshot();
    if (existing?.id === userId && !force) {
      setUserProfile(existing);
      return existing;
    }

    try {
      const { data } = await api.get('/profile/context', { params: { userId } });
      const profile = data?.profile || { id: userId, meta_configured: false };
      writeProfileSnapshot(profile);
      setUserProfile(profile);
      return profile;
    } catch (error) {
      console.warn('Unable to load profile context.', error?.response?.data?.message || error?.message || error);
      const fallbackProfile = existing?.id === userId ? existing : { id: userId, meta_configured: false, specialization: '' };
      writeProfileSnapshot(fallbackProfile);
      setUserProfile(fallbackProfile);
      return fallbackProfile;
    }
  }, []);

  const restoreSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const supabaseUser = data?.session?.user;

      if (supabaseUser?.id) {
        persistSupabaseSession(supabaseUser);
        setUser(supabaseUser);
        await loadUserProfile(supabaseUser.id);
        return supabaseUser;
      }

      const storedUser = userFromStoredSession();
      setUser(storedUser);
      if (storedUser?.id) await loadUserProfile(storedUser.id);
      return storedUser;
    } catch (error) {
      console.warn('Unable to restore auth session.', error?.message || error);
      const storedUser = userFromStoredSession();
      setUser(storedUser);
      if (storedUser?.id) await loadUserProfile(storedUser.id);
      return storedUser;
    } finally {
      setLoading(false);
    }
  }, [loadUserProfile]);

  const logout = useCallback(async () => {
    clearStoredAuthSession();
    clearProfileSnapshot();
    setUser(null);
    setUserProfile(null);
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
          loadUserProfile(session.user.id);
        }
        setLoading(false);
      }

      if (event === 'SIGNED_OUT') {
        const storedUser = userFromStoredSession();
        setUser(storedUser);
        if (storedUser?.id) loadUserProfile(storedUser.id);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [loadUserProfile, restoreSession]);

  const value = useMemo(() => ({
    user,
    userProfile,
    loading,
    isAuthenticated: Boolean(user?.id || getStoredAuthToken()),
    restoreSession,
    loadUserProfile,
    logout,
  }), [loadUserProfile, loading, logout, restoreSession, user, userProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
