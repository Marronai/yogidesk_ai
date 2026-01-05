import React, { useState } from 'react';
import axios from 'axios';
import { Send, Smartphone } from 'lucide-react';

const Campaigns = () => {
  const [loading, setLoading] = useState(false);

  const sendTestMessage = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // 👇 YAHAN FRONTEND, BACKEND SE BAAT KARTA HAI
      const res = await axios.post('http://localhost:5000/api/whatsapp/send-test', 
        { phoneNumber: "919999999999" }, // ⚠️ Yahan apna verified test number daalein (91 ke saath)
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if(res.data.success) {
        alert("Message Sent via WhatsApp! 🚀");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to send message. Check Console.");
    }
    setLoading(false);
  };

  return (
    <div className="p-10 bg-[#fcfcfc] min-h-screen">
      <h1 className="text-3xl font-black mb-6">Campaign Manager</h1>
      
      <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm max-w-md">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
            <Smartphone size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg">Test Connection</h3>
            <p className="text-sm text-gray-500">Send a Hello World message</p>
          </div>
        </div>

        <button 
          onClick={sendTestMessage}
          disabled={loading}
          className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all"
        >
          {loading ? 'Sending...' : <><Send size={18} /> Send Test Message</>}
        </button>
      </div>
    </div>
  );
};

export default Campaigns;