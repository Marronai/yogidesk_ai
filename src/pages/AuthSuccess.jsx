import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { persistSupabaseSession } from '../utils/authSession';

const AuthSuccess = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const completeSupabaseOAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const user = data.session?.user;
        if (!user) {
          throw new Error('Supabase session missing after OAuth redirect');
        }

        persistSupabaseSession(user, { welcomeGift: true });
        localStorage.setItem('user_subscription_status', 'active');
        console.log('Google login successful:', user.email);

        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } catch (error) {
        console.error('Supabase OAuth completion error:', error);
        navigate('/login?error=invalid_token');
      }
    };

    completeSupabaseOAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-white">
      <div className="text-center">
        <Loader2 size={48} className="animate-spin text-[#FF6B00] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Logging you in...</h2>
        <p className="text-gray-600">Please wait while we complete your Google sign-in.</p>
      </div>
    </div>
  );
};

export default AuthSuccess;
