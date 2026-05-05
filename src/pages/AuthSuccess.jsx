import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jwtDecode from 'jwt-decode';
import { Loader2 } from 'lucide-react';

const AuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      try {
        // ✅ Decode token to get user info
        const decoded = jwtDecode(token);
        
        // ✅ Store in localStorage (same as regular signup)
        localStorage.setItem('token', token);
        localStorage.setItem('user_role', decoded.role || 'trial_user');
        localStorage.setItem('user_name', decoded.name || 'User');
        
        console.log('✅ Google login successful:', decoded.email);
        
        // ✅ Redirect to dashboard after 1 second
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } catch (error) {
        console.error('❌ Token decode error:', error);
        navigate('/login?error=invalid_token');
      }
    } else {
      console.error('❌ No token received from Google');
      navigate('/login?error=token_missing');
    }
  }, [searchParams, navigate]);

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