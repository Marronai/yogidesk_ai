import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Search, FileSpreadsheet, Trash2, 
  Users, RefreshCw, Phone, Plus, Loader
} from 'lucide-react';

const Contacts = () => {
  const [contacts, setContacts] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // --- 🛠️ DATA NORMALIZER (Safety Net) ---
  const normalizeData = (rawData) => {
    if (!Array.isArray(rawData)) return [];

    return rawData.map(item => {
      // Backend se aane wale keys check karo
      const keys = Object.keys(item);
      
      const nameKey = keys.find(k => ['name', 'fullname', 'user', 'customer'].includes(k.toLowerCase().trim()));
      const phoneKey = keys.find(k => ['phone', 'mobile', 'contact', 'number', 'phone no'].includes(k.toLowerCase().trim()));

      return {
        _id: item._id || Math.random().toString(),
        name: nameKey ? item[nameKey] : "Unknown",
        phone: phoneKey ? item[phoneKey] : "No Number",
        createdAt: item.createdAt
      };
    });
  };

  // --- FETCH CONTACTS ---
  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/contacts');

      console.log("🔥 API Data:", res.data); // Console check

      const rawList = Array.isArray(res.data) ? res.data : (res.data.contacts || []);
      const cleanList = normalizeData(rawList);
      
      setContacts(cleanList);
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // --- UPLOAD CSV ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await api.post('/contacts/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      alert("Success! Contacts Imported.");
      setTimeout(fetchContacts, 1000); 
    } catch (err) {
      alert("Upload Failed. Check CSV format.");
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  // --- DELETE CONTACT ---
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    try {
        await api.delete(`/contacts/${id}`);
        setContacts(contacts.filter(c => c._id !== id));
    } catch (error) {
        alert("Delete Failed");
    }
  };

  // --- SEARCH FILTER ---
  const filteredContacts = contacts.filter(c => 
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (c.phone && c.phone.toString().includes(searchTerm))
  );

  // --- 🛡️ SAFE RENDER FUNCTION (Crash Proof) ---
  const renderTableRows = () => {
    if (filteredContacts.length === 0) {
        return (
            <tr>
              <td colSpan="3" className="p-32 text-center">
                <div className="flex flex-col items-center gap-5 opacity-20">
                  <Users size={100}/>
                  <p className="font-black uppercase tracking-[0.4em] text-xs">List is Empty</p>
                </div>
              </td>
            </tr>
        );
    }

    return filteredContacts.map((contact, index) => (
        <tr key={contact._id || index} className="group hover:bg-slate-50/50 transition-all">
          {/* Name Column */}
          <td className="px-12 py-6">
            <div className="flex items-center gap-5">
               <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                 {(contact.name || 'U').toString().charAt(0).toUpperCase()}
               </div>
               <span className="font-bold text-slate-800 text-xl tracking-tight">
                 {contact.name || 'Unknown'}
               </span>
            </div>
          </td>

          {/* Phone Column */}
          <td className="px-12 py-6 text-center">
            <div className="inline-flex items-center gap-2 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 font-bold text-slate-600 tracking-wider">
              <Phone size={14} className="text-orange-500"/>
              {contact.phone || 'No Number'}
            </div>
          </td>

          {/* Action Column (Delete) */}
          <td className="px-12 py-6 text-right">
             <button 
                onClick={() => handleDelete(contact._id)}
                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
             >
                <Trash2 size={20}/>
             </button>
          </td>
        </tr>
    ));
  };

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl"><Users size={24}/></div>
             <div>
                <h1 className="text-2xl font-black text-slate-900 italic">Audience</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Total Contacts: {filteredContacts.length}
                </p>
             </div>
          </div>
          
          <div className="flex gap-3">
            <button onClick={fetchContacts} className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100">
              <RefreshCw size={20} className={loading ? "animate-spin text-orange-500" : "text-slate-400"} />
            </button>
            <label className="cursor-pointer bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 shadow-xl active:scale-95 transition-all">
              {uploading ? "Importing..." : <><FileSpreadsheet size={18}/> Import CSV</>}
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={22} />
          <input 
            type="text" 
            placeholder="Search Name or Phone..." 
            className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-50 rounded-[2.5rem] outline-none font-medium text-lg placeholder:text-slate-300 focus:border-orange-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50 text-[11px] uppercase text-slate-400 font-black tracking-[0.2em]">
                <th className="px-12 py-7 underline decoration-orange-500/30">Name</th>
                <th className="px-12 py-7 underline decoration-orange-500/30 text-center">Phone No</th>
                <th className="px-12 py-7 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="3" className="p-32 text-center animate-pulse text-slate-300 font-black uppercase tracking-widest">Loading Data...</td></tr>
              ) : (
                renderTableRows()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Contacts;