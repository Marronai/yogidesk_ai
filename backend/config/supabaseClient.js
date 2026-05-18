// src/config/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase client initialize kiya
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Google Sign-In Trigger Function
export const handleGoogleSignIn = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Login hone ke baad user ko is page par bhejega jahan hum uska specialization fill karwayenge
      redirectTo: `${window.location.origin}/signup`, 
    },
  });

  if (error) {
    console.error("Google Auth Error:", error.message);
  }
};