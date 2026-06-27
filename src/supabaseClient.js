// Compatibility entry point. Keep every consumer on the same auth/session client.
export { getOAuthRedirectUrl, handleGoogleSignIn, supabase } from './config/supabaseClient';
