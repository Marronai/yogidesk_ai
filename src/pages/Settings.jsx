import React, { useState, useEffect } from 'react';
import { User, Building2, Lock, Save, Camera, ShieldCheck, Smartphone, Briefcase } from 'lucide-react';
import axios from 'axios';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessName: '',
    industry: 'general',
    whatsappPhoneNumberId: '',
    whatsappWabaId: '',
    whatsappAccessToken: ''
  });

  // 1. Load User Data on Page Mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('http://localhost:5000/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const user = res.data;
        setFormData({
          name: user.name || '',
          email: user.email || '',
          businessName: user.businessName || '',
          industry: user.industry || 'general',
          whatsappPhoneNumberId: user.whatsappConfig?.phoneNumberId || '',
          whatsappWabaId: user.whatsappConfig?.wabaId || '',
          whatsappAccessToken: user.whatsappConfig?.accessToken || ''
        });
      } catch (err) {
        console.error("Failed to load user data");
      }
    };
    fetchUserData();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:5000/api/settings/update', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Settings Saved Successfully! 🚀");
      // Page refresh ya state update karein taaki dashboard change ho jaye
      window.location.reload(); 
    } catch (err) {
      alert(err.response?.data?.msg || "Update Failed");
    }
    setLoading(false);
  };

  return (
    <div className="p-8 bg-[#fcfcfc] min-h-screen font-sans">
      <div className="max-w-5xl">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Marroncorp AI Settings</h1>
          <p className="text-gray-500 font-medium">Configure your brand, industry, and WhatsApp API keys.</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Tabs */}
          <div className="w-64 space-y-2">
            {[
              { id: 'profile', label: 'Profile', icon: <User size={18}/> },
              { id: 'business', label: 'Business & Industry', icon: <Building2 size={18}/> },
              { id: 'whatsapp', label: 'WhatsApp API', icon: <Smartphone size={18}/> },
              { id: 'security', label: 'Security', icon: <Lock size={18}/> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                  activeTab === tab.id ? 'bg-orange-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div className="flex-1 bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
            <form onSubmit={handleUpdate} className="space-y-6">
              
              {/* PROFILE TAB */}
              {activeTab === 'profile' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-gray-400 ml-2">Full Name</label>
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase text-gray-400 ml-2">Email Address</label>
                      <input type="email" value={formData.email} disabled className="w-full bg-gray-100 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-400 cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              )}

              {/* BUSINESS & INDUSTRY TAB */}
              {activeTab === 'business' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-gray-400 ml-2">Business Name</label>
                    <input 
                      type="text" 
                      value={formData.businessName}
                      onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-gray-400 ml-2">Select Industry (Customizes Dashboard)</label>
                    <select 
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500 appearance-none"
                    >
                      <option value="general">General Business</option>
                      <option value="hospital">Hospital & Healthcare 🏥</option>
                      <option value="education">Education & Coaching 🎓</option>
                      <option value="startup">SaaS & Startups 🚀</option>
                      <option value="ecommerce">E-commerce 🛒</option>
                    </select>
                  </div>
                </div>
              )}

              {/* WHATSAPP API TAB */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 text-blue-700 text-sm">
                    <Briefcase size={20} className="shrink-0"/>
                    <p>Enter your Meta WhatsApp Business API credentials here. This allows the system to send messages using your own number.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-gray-400 ml-2">Phone Number ID</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 10987654321"
                      value={formData.whatsappPhoneNumberId}
                      onChange={(e) => setFormData({...formData, whatsappPhoneNumberId: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-gray-400 ml-2">WABA ID</label>
                    <input 
                      type="text" 
                      placeholder="WhatsApp Business Account ID"
                      value={formData.whatsappWabaId}
                      onChange={(e) => setFormData({...formData, whatsappWabaId: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-gray-400 ml-2">Permanent Access Token</label>
                    <input 
                      type="password" 
                      placeholder="EAAMz..."
                      value={formData.whatsappAccessToken}
                      onChange={(e) => setFormData({...formData, whatsappAccessToken: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-600 font-bold text-xs">
                  <ShieldCheck size={16}/> Security: Your keys are encrypted.
                </div>
                <button 
                  disabled={loading}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black flex items-center gap-2 transition-all active:scale-95 shadow-xl"
                >
                  <Save size={16}/> {loading ? 'Saving...' : 'Save All Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;