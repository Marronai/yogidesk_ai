import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getSiteOrigin = () => {
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    browserOrigin ||
    import.meta.env.VITE_SITE_URL ||
    import.meta.env.VITE_PUBLIC_SITE_URL ||
    ''
  ).replace(/\/+$/, '');
};

export const getOAuthRedirectUrl = (path = '/auth-success') => `${getSiteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;

export const handleGoogleSignIn = async (redirectTo = getOAuthRedirectUrl('/auth-success')) => {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
};
