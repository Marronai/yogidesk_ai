import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Send, CheckCircle, FileSpreadsheet, X } from 'lucide-react';
import axios from 'axios';

const HospitalDischarge = () => {
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newPatient, setNewPatient] = useState({ name: '', phone: '', email: '', doctorName: '' });

  const fetchPatients = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get('http://localhost:5000/api/hospital/patients', {
      headers: { Authorization: `Bearer ${token}` }
    });
    setPatients(res.data);
  };

  useEffect(() => { fetchPatients(); }, []);

  // ➕ Add Patient Logic
  const handleAddPatient = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/hospital/admit', newPatient, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      setNewPatient({ name: '', phone: '', email: '', doctorName: '' });
      fetchPatients(); // List refresh
    } catch (err) {
      alert("Error adding patient");
    }
  };

  const handleDischarge = async (patientId) => {
    if (!window.confirm("Discharge this patient and send WhatsApp feedback?")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/hospital/discharge', { patientId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPatients();
    } catch (err) {
      alert("Discharge failed. Check WhatsApp Settings.");
    }
  };

  return (
    <div className="p-8 bg-[#fcfcfc] min-h-screen relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Patient Management</h1>
          <p className="text-gray-500 font-medium italic">Yogi Desk AI Healthcare Suite</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-orange-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:shadow-xl hover:shadow-orange-500/30 transition-all active:scale-95"
        >
          <UserPlus size={18}/> Add New Patient
        </button>
      </div>

      {/* Search & Table (Same as before) */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder="Search patient..."
          className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 shadow-sm outline-none focus:ring-2 focus:ring-orange-500"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em]">
            <tr>
              <th className="p-6">Patient Details</th>
              <th className="p-6">Status</th>
              <th className="p-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {patients.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map((patient) => (
              <tr key={patient._id} className="hover:bg-gray-50/40 transition-colors">
                <td className="p-6">
                  <div className="font-bold text-gray-900">{patient.name}</div>
                  <div className="text-xs text-gray-500">{patient.phone} | {patient.doctorName}</div>
                </td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${patient.status === 'discharged' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                    {patient.status}
                  </span>
                </td>
                <td className="p-6 text-right">
                  {patient.status === 'admitted' ? (
                    <button onClick={() => handleDischarge(patient._id)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-black">Discharge</button>
                  ) : (
                    <div className="text-green-600 font-bold text-xs flex items-center justify-end gap-1"><CheckCircle size={14}/> Sent</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🧾 ADD PATIENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-gray-900">New Admission</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleAddPatient} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Patient Name</label>
                <input required type="text" className="w-full bg-gray-50 rounded-2xl p-4 mt-1 border-none focus:ring-2 focus:ring-orange-500" placeholder="John Doe" onChange={(e) => setNewPatient({...newPatient, name: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Phone (with 91)</label>
                <input required type="text" className="w-full bg-gray-50 rounded-2xl p-4 mt-1 border-none focus:ring-2 focus:ring-orange-500" placeholder="919876..." onChange={(e) => setNewPatient({...newPatient, phone: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Doctor In-charge</label>
                <input type="text" className="w-full bg-gray-50 rounded-2xl p-4 mt-1 border-none focus:ring-2 focus:ring-orange-500" placeholder="Dr. Smith" onChange={(e) => setNewPatient({...newPatient, doctorName: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest mt-4 hover:bg-orange-700 shadow-lg">Confirm Admission</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalDischarge;
