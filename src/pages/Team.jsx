import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UserPlus, Trash2, RefreshCw, Eye, EyeOff, Clock, ShieldAlert } from 'lucide-react';

const Team = () => {
  const [members, setMembers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Current User Role Check (LocalStorage se)
  const myRole = localStorage.getItem('user_role'); // 'admin', 'manager', 'employee'

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'employee', 
    shiftStart: '09:00', shiftEnd: '18:00', canViewAds: false
  });

  // --- 1. LOAD MEMBERS ---
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/team', {
        headers: { Authorization: `Bearer ${token}` }
      }); 
      setMembers(res.data);
    } catch (err) { console.log(err); }
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  // --- 2. ADD MEMBER ---
  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:5000/api/team/add', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`User Added! Password: ${formData.password}`);
      setShowModal(false);
      // Reset Form
      setFormData({ name: '', email: '', password: '', role: 'employee', shiftStart: '09:00', shiftEnd: '18:00', canViewAds: false });
      fetchMembers(); 

    } catch (err) {
      alert("Failed: " + (err.response?.data?.msg || "Error adding user"));
    }
  };

  // --- 3. DELETE MEMBER (Only Admin UI me dikhega) ---
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure? Only Admins can do this.")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/team/delete/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMembers(members.filter(m => m._id !== id));
      alert("Deleted Successfully");
    } catch (err) {
      alert("Delete Failed: " + (err.response?.data?.msg || "Permission Denied"));
    }
  };

  return (
    <div className="p-8 font-sans">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Team Management</h1>
          <p className="text-gray-500">Manage your team, shifts, and permissions.</p>
        </div>
        
        <div className="flex gap-3">
            <button onClick={fetchMembers} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-600"><RefreshCw size={20} className={loading ? "animate-spin" : ""} /></button>
            
            {/* 🔥 Logic: Employee Add button nahi dekh sakta */}
            {myRole !== 'employee' && (
              <button onClick={() => setShowModal(true)} className="bg-orange-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-orange-700 shadow-lg shadow-orange-600/20">
               <UserPlus size={20} /> Add Member
              </button>
            )}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 font-medium">
            <tr><th className="p-4">Name</th><th className="p-4">Role</th><th className="p-4">Shift & Access</th><th className="p-4">Actions</th></tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400">No members found.</td></tr>
            ) : (
              members.map((member) => (
                <tr key={member._id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-bold text-gray-800">{member.name}</p>
                    <p className="text-xs text-gray-400">{member.email}</p>
                  </td>
                  <td className="p-4"><span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">{member.role.toUpperCase()}</span></td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-600 flex items-center gap-1"><Clock size={12}/> {member.settings?.shiftStart || "09:00"} - {member.settings?.shiftEnd || "18:00"}</span>
                      {member.settings?.canViewAds && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded w-fit font-bold">Ads Access</span>}
                    </div>
                  </td>
                  <td className="p-4 text-red-400 hover:text-red-600 cursor-pointer">
                    {/* 🔥 Logic: Sirf ADMIN delete button dekh sakta hai */}
                    {myRole === 'admin' ? (
                       <button onClick={() => handleDelete(member._id)}><Trash2 size={18}/></button>
                    ) : (
                       <span className="text-gray-300"><ShieldAlert size={18}/></span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal - 🔥 RESTORED FIELDS */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">Add New Member</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              
              {/* Name & Email */}
              <div className="grid grid-cols-2 gap-4">
                 <input required placeholder="Name" className="w-full border p-2 rounded-lg" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                 <input required type="email" placeholder="Email" className="w-full border p-2 rounded-lg" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>

              {/* Password */}
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} placeholder="Set Password" className="w-full border p-2 rounded-lg" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400">{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
              </div>

              {/* Role */}
              <select className="w-full border p-2 rounded-lg" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="employee">Agent</option><option value="manager">Manager</option>
              </select>

              {/* 🔥 RESTORED: Shift Timings */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border">
                <div>
                   <label className="text-xs font-bold text-gray-500">Shift Start</label>
                   <input type="time" className="w-full bg-white border p-1 rounded" value={formData.shiftStart} onChange={e => setFormData({...formData, shiftStart: e.target.value})} />
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-500">Shift End</label>
                   <input type="time" className="w-full bg-white border p-1 rounded" value={formData.shiftEnd} onChange={e => setFormData({...formData, shiftEnd: e.target.value})} />
                </div>
              </div>

              {/* 🔥 RESTORED: Ads Access Checkbox */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ads" className="w-4 h-4" checked={formData.canViewAds} onChange={e => setFormData({...formData, canViewAds: e.target.checked})} />
                <label htmlFor="ads" className="text-sm font-medium text-gray-700">Allow access to Ads CRM?</label>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="submit" className="flex-1 bg-orange-600 text-white py-2 rounded-lg font-bold">Add User</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg font-bold">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Team;