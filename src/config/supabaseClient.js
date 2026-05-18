import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const handleGoogleSignIn = async (redirectTo = `${window.location.origin}/auth-success`) => {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
};
