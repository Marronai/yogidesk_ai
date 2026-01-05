// FILE: src/pages/AgentDashboard.jsx
import React from 'react';
import { MessageSquare, Megaphone, Clock } from 'lucide-react';

const AgentDashboard = () => {
  // Local data for greeting
  const userName = localStorage.getItem('user_name') || 'Agent';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Hello, {userName} 👋</h1>
        <p className="text-gray-500">Ready to start your shift? Here is your overview.</p>
      </div>

      {/* Stats Cards for Agent */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold">12</h3>
            <p className="text-gray-500 text-sm">New Leads</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold">09:00 - 18:00</h3>
            <p className="text-gray-500 text-sm">Today's Shift</p>
          </div>
        </div>
      </div>

      {/* Work Area */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
        <Megaphone size={48} className="mx-auto text-gray-300 mb-4"/>
        <h3 className="text-xl font-bold text-gray-800">No Active Tasks</h3>
        <p className="text-gray-500 mb-6">Check your inbox for new customer queries.</p>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700">
          Go to Inbox
        </button>
      </div>
    </div>
  );
};

export default AgentDashboard;