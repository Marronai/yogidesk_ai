import { createClient } from '@supabase/supabase-js';

const PRODUCTION_SUPABASE_URL = 'https://oxvlgzjunhecgzfbfbwk.supabase.co';
const PRODUCTION_SUPABASE_ANON_KEY = 'sb_publishable_IZ7bMdKm-dlob35VVIy0kQ_Tna0ie9C';

const readBuildValue = (value, fallback) => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const supabaseUrl = readBuildValue(import.meta.env.VITE_SUPABASE_URL, PRODUCTION_SUPABASE_URL);
const supabaseAnonKey = readBuildValue(import.meta.env.VITE_SUPABASE_ANON_KEY, PRODUCTION_SUPABASE_ANON_KEY);

// Capacitor's WebView normally exposes localStorage, but a guarded adapter keeps
// auth usable when storage is temporarily unavailable during native startup.
const memoryStorage = new Map();
const hybridStorage = {
  getItem(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem(key, value) {
    memoryStorage.set(key, value);
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // In-memory persistence keeps the current WebView session operational.
    }
  },
  removeItem(key) {
    memoryStorage.delete(key);
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Storage may be unavailable briefly while the native bridge initializes.
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: hybridStorage,
  },
});

const getSiteOrigin = () => {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    import.meta.env.VITE_SITE_URL ||
    import.meta.env.VITE_PUBLIC_SITE_URL ||
    browserOrigin ||
    'https://yogidesk-ai.com'
  ).replace(/\/+$/, '');
};

export const getOAuthRedirectUrl = (path = '/auth-success') => `${getSiteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;

export const handleGoogleSignIn = async (redirectTo = getOAuthRedirectUrl('/auth-success')) => {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
};
