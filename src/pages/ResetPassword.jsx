import React, { useState } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const { resetToken } = useParams(); // URL se token nikalo
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/auth/resetpassword/${resetToken}`, { password });
      alert("Password Reset Successful! Login now.");
      navigate('/login');
    } catch (error) {
      alert("Error: Token invalid or expired.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-2">Set New Password 🔑</h2>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
             <Lock size={18} className="text-gray-400" />
             <input type="password" required placeholder="New Password" className="bg-transparent w-full outline-none" onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">Update Password</button>
        </form>
      </div>
    </div>
  );
};
export default ResetPassword;