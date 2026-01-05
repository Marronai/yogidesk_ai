import React, { useState } from 'react';
import { 
  Download, Filter, Facebook, Globe, Search, RefreshCw, 
  Plus, ArrowUpRight, MessageCircle, Check, MoreHorizontal,
  LayoutGrid, ListFilter, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LeadsCRM = () => {
  const navigate = useNavigate();
  const [showConnectModal, setShowConnectModal] = useState(false);
  
  // 🔥 PAGINATION STATE
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Mock Data (Total 12 leads for demo pagination)
  const [leads] = useState([
    { id: 1, name: "Rahul Sharma", phone: "9876543210", source: "Meta Ads", campaign: "Summer Sale", status: "New", date: "10:30 AM" },
    { id: 2, name: "Sneha Gupta", phone: "9988776655", source: "Google Ads", campaign: "Brand Search", status: "Contacted", date: "Yesterday" },
    { id: 3, name: "Amit Verma", phone: "8877665544", source: "Meta Ads", campaign: "Free Checkup", status: "Converted", date: "2 days ago" },
    { id: 4, name: "Priya Singh", phone: "7766554433", source: "Google Ads", campaign: "Retargeting", status: "New", date: "3 days ago" },
    { id: 5, name: "Vikram Malhotra", phone: "9988001122", source: "Meta Ads", campaign: "Summer Sale", status: "Contacted", date: "Just now" },
    { id: 6, name: "Anjali Das", phone: "8899776655", source: "Meta Ads", campaign: "Diwali Offer", status: "New", date: "4 days ago" },
    { id: 7, name: "Rohan Mehra", phone: "7766554433", source: "Google Ads", campaign: "Brand Search", status: "New", date: "5 days ago" },
    // ... aur data ho sakta hai
  ]);

  // 🔥 PAGINATION LOGIC
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeads = leads.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(leads.length / itemsPerPage);

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  // 🔥 CONNECT LOGIC (Simulation)
  const handleConnect = (platform) => {
    alert(`Redirecting to ${platform} Login...`);
    // Asli code me yaha Facebook SDK login call hoga
    setShowConnectModal(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Leads Manager</h1>
          <p className="text-gray-500 mt-2 text-base">
            Centralized hub for all your ad leads. Syncs automatically every 15 mins.
          </p>
        </div>
        
        <div className="flex gap-4">
           <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-bold shadow-sm">
             <RefreshCw size={18}/> Sync Now
           </button>
           <button 
             onClick={() => setShowConnectModal(true)}
             className="flex items-center gap-2 px-6 py-2.5 bg-brand hover:bg-brand-dark text-white rounded-xl transition shadow-lg shadow-brand/20 font-bold transform hover:-translate-y-0.5"
           >
             <Plus size={20}/> Connect Source
           </button>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Leads Today</p>
                  <h3 className="text-4xl font-extrabold text-gray-900 mt-1">{leads.length}</h3>
               </div>
               <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><LayoutGrid size={24}/></div>
            </div>
            <div className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded w-fit">+12% vs yesterday</div>
         </div>
         {/* ... Baki cards same rahenge ... */}
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Active Campaigns</p>
                  <h3 className="text-4xl font-extrabold text-gray-900 mt-1">3 <span className="text-lg text-gray-400 font-medium">Running</span></h3>
               </div>
               <div className="p-3 bg-green-50 text-green-600 rounded-xl"><Globe size={24}/></div>
            </div>
            <div className="text-xs font-medium text-gray-500">Meta (2) • Google (1)</div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-32 border-l-4 border-l-brand">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Auto-Replies Sent</p>
                  <h3 className="text-4xl font-extrabold text-gray-900 mt-1">42 <span className="text-lg text-gray-400 font-medium">/ 45</span></h3>
               </div>
               <div className="p-3 bg-orange-50 text-brand rounded-xl"><MessageCircle size={24}/></div>
            </div>
            <div className="text-xs font-medium text-green-600">93% Success Rate</div>
         </div>
      </div>

      {/* MAIN TABLE */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between bg-white items-center">
            <div className="relative w-full max-w-md">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input 
                  placeholder="Search by name, phone or campaign..." 
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition text-sm font-medium"
                />
            </div>
            <div className="flex gap-3">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-brand transition text-sm font-bold"><ListFilter size={18}/> Filters</button>
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-green-600 transition text-sm font-bold"><Download size={18}/> Export CSV</button>
            </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase font-bold tracking-wider">
              <tr>
                <th className="p-6">Lead Details</th>
                <th className="p-6">Source</th>
                <th className="p-6">Campaign</th>
                <th className="p-6">Status</th>
                <th className="p-6">Auto-Reply</th>
                <th className="p-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50/80 transition duration-150 group">
                  <td className="p-6">
                    <div className="font-bold text-gray-900 text-base">{lead.name}</div>
                    <div className="text-sm text-gray-400 mt-0.5">{lead.phone}</div>
                  </td>
                  <td className="p-6">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${lead.source === 'Meta Ads' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                      {lead.source === 'Meta Ads' ? <Facebook size={14}/> : <Globe size={14}/>}
                      {lead.source}
                    </span>
                  </td>
                  <td className="p-6"><span className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1 rounded-full">{lead.campaign}</span></td>
                  <td className="p-6">
                    <span className={`text-xs px-3 py-1.5 rounded-full border font-bold ${
                      lead.status === 'New' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                      lead.status === 'Converted' ? 'bg-green-50 text-green-700 border-green-100' : 
                      'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>{lead.status}</span>
                  </td>
                  <td className="p-6">
                     <div className="flex items-center gap-1.5 text-xs text-green-700 font-bold bg-green-50 w-fit px-3 py-1.5 rounded-lg">
                        <Check size={14} strokeWidth={3}/> Sent
                     </div>
                  </td>
                  <td className="p-6 text-right">
                    <button onClick={() => navigate('/inbox')} className="text-brand bg-brand/5 hover:bg-brand/10 border border-brand/10 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ml-auto">
                       Chat <ArrowUpRight size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 🔥 WORKING PAGINATION */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center text-sm text-gray-500">
            <span>Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, leads.length)} of {leads.length} leads</span>
            <div className="flex gap-2">
                <button 
                  onClick={handlePrev} 
                  disabled={currentPage === 1}
                  className="px-4 py-2 border bg-white rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition"
                >
                  <ChevronLeft size={16}/> Previous
                </button>
                <button 
                  onClick={handleNext} 
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border bg-white rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition"
                >
                  Next <ChevronRight size={16}/>
                </button>
            </div>
        </div>

      </div>

      {/* 🔥 WORKING MODAL */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative transform transition-all scale-100">
                <button onClick={() => setShowConnectModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"><X size={20}/></button>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connect Ad Platform</h3>
                <p className="text-gray-500 text-sm mb-6">Select a platform to import leads automatically.</p>
                
                <div className="space-y-3">
                    <button onClick={() => handleConnect('Meta')} className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition group">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-2 rounded-lg text-white"><Facebook size={20}/></div>
                            <span className="font-bold text-gray-700 group-hover:text-blue-700">Meta (Facebook/Insta)</span>
                        </div>
                        <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">Recommended</span>
                    </button>
                    
                    <button onClick={() => handleConnect('Google')} className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition group">
                        <div className="flex items-center gap-3">
                            <div className="bg-red-500 p-2 rounded-lg text-white"><Globe size={20}/></div>
                            <span className="font-bold text-gray-700 group-hover:text-red-700">Google Ads</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default LeadsCRM;