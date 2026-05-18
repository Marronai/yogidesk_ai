import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        // 📝 SIGNUP LOGIC
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Registration Successful! Please check your email for confirmation link.');
      } else {
        // 🔑 LOGIN LOGIC
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Login Successful! Redirecting...');
        // Yahan aap dashboard par redirect karne ka logic daal sakte hain
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '30px', boxShadow: '0px 0px 15px rgba(0,0,0,0.1)', borderRadius: '10px', fontFamily: 'Arial' }}>
      <h2 style={{ textAlign: 'center', color: '#4F46E5' }}>
        {isSignUp ? 'Create Doctor Account' : 'Yogi Desk Doctor Login'}
      </h2>
      
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <input 
          type="email" 
          placeholder="Enter Clinic Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          required 
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <input 
          type="password" 
          placeholder="Enter Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
          style={{ padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        
        <button 
          type="submit" 
          disabled={loading}
          style={{ padding: '12px', background: '#4F46E5', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      {message && <p style={{ marginTop: '15px', textAlign: 'center', fontSize: '14px', color: message.startsWith('❌') ? 'red' : 'green' }}>{message}</p>}

      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <span 
          onClick={() => setIsSignUp(!isSignUp)} 
          style={{ color: '#4F46E5', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
        >
          {isSignUp ? 'Login Here' : 'Register Here'}
        </span>
      </p>
    </div>
  );
}