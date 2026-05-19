import React, { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Users, Phone, Plus, UserPlus, UploadCloud, X, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import api from '../utils/api';

const planCaps = { starter: 500, growth: 2000, hospital: 1000000 };

const Contacts = () => {
  const [contacts, setContacts] = useState([]);
  const [walletMeta, setWalletMeta] = useState({ current_plan: 'starter', lifetime_contacts_count: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [manualPatient, setManualPatient] = useState({ name: '', phone: '' });
  const [quickPatient, setQuickPatient] = useState({ name: '', phone: '' });
  const [manualTime, setManualTime] = useState({ hour: '11', minute: '30', period: 'AM' });
  const backendPath = (path) => String(api.defaults?.baseURL || '').replace(/\/+$/, '').endsWith('/api') ? path.replace(/^\/api/, '') : path;

  const plan = String(walletMeta.current_plan || 'starter').toLowerCase();
  const maxCap = planCaps[plan] || planCaps.starter;
  const lifetimeCount = Number(walletMeta.lifetime_patients_count ?? walletMeta.lifetime_contacts_count ?? 0);
  const isAtLimit = lifetimeCount >= maxCap;
  const metricClass = lifetimeCount <= 350 ? 'border-green-500 bg-green-50 text-green-700' : lifetimeCount <= 450 ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-red-500 bg-red-50 text-red-700 animate-pulse';
  const metricText = `${lifetimeCount} / ${maxCap === 1000000 ? 'Unlimited' : maxCap} Contacts`;
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); };
  const appointmentTime = ({ hour, minute, period }) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;

  const getSessionUser = async () => {
    const { data } = await supabase.auth.getUser();
    const id = data?.user?.id || localStorage.getItem('user_id');
    return id ? { id } : null;
  };

  const filteredContacts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name?.toLowerCase().includes(q) || String(c.phone || '').includes(q));
  }, [contacts, searchTerm]);

  const fetchLedger = async () => {
    const user = await getSessionUser();
    if (!user) return;
    setLoading(true);
    const [{ data }, usageResult] = await Promise.all([
      supabase.from('patients_ledger').select('*').eq('user_id', user.id),
      api.get(backendPath('/api/user/usage'), { params: { userId: user.id } }).catch(() => ({ data: null }))
    ]);
    setContacts(Array.isArray(data) ? data : []);
    if (usageResult.data) {
      setWalletMeta({
        current_plan: usageResult.data.current_plan || 'starter',
        lifetime_patients_count: usageResult.data.lifetime_patients_count || 0
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchLedger(); }, []);

  const blockIfLimited = (incoming = 1) => {
    if (lifetimeCount + incoming <= maxCap) return false;
    setIsUpgradeModalOpen(true);
    notify('Contact limit reached. Please upgrade your plan.');
    return true;
  };

  const addPatient = async ({ name, phone, appointment_time }) => {
    const user = await getSessionUser();
    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!user) return notify('Login session expired. Please sign in again.');
    if (blockIfLimited(1)) return;
    if (!cleanName) return notify('Name is required.');
    if (cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) return notify('Please enter a valid 10-digit mobile number.');
    if (contacts.some((c) => c.phone === cleanPhone)) return notify('Duplicate phone skipped.');

    const row = { user_id: user.id, name: cleanName, phone: cleanPhone, appointment_time: appointment_time || null };
    const response = await api.post(backendPath('/api/patients'), { ...row, userId: user.id }).catch((error) => ({ error }));
    if (response.error) return notify(response.error?.response?.data?.message || response.error.message || 'Patient sync failed.');
    setWalletMeta((cur) => ({ ...cur, lifetime_patients_count: response.data?.lifetime_patients_count ?? lifetimeCount + 1 }));
    setContacts((cur) => [response.data?.data, ...cur].filter(Boolean));
    notify('Patient synced.');
    return true;
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const ok = await addPatient({ ...manualPatient, appointment_time: appointmentTime(manualTime) });
    if (!ok) return;
    setManualPatient({ name: '', phone: '' });
    setManualTime({ hour: '11', minute: '30', period: 'AM' });
    setIsManualModalOpen(false);
  };

  const handleQuickAdd = async () => {
    const ok = await addPatient(quickPatient);
    if (ok) setQuickPatient({ name: '', phone: '' });
  };

  const parseImportFile = async (file) => {
    if (!file) return;
    const user = await getSessionUser();
    if (!user) return notify('Login session expired. Please sign in again.');
    if (isAtLimit) return blockIfLimited(1);
    setImporting(true);
    try {
      const raw = await file.text();
      const parsedRows = raw
        .split(/\r?\n/)
        .map((line) => line.split(/,|\t|;/).map((cell) => cell.trim()))
        .filter((row) => row.some(Boolean))
        .map(([name, phone, appointment_time]) => ({
          user_id: user.id,
          name,
          phone: String(phone || '').trim().replace(/\s+/g, ''),
          appointment_time: appointment_time || null
        }))
        .filter((row) => row.name && /^\d{10}$/.test(row.phone) && !contacts.some((c) => c.phone === row.phone));

      const remaining = maxCap - lifetimeCount;
      if (remaining <= 0) return blockIfLimited(1);
      const rows = parsedRows.slice(0, remaining);
      if (!rows.length) return notify('No valid rows found.');
      if (parsedRows.length > rows.length) notify('Some rows skipped due to contact limit.');

      const response = await api.post(backendPath('/api/patients/bulk'), { userId: user.id, patients: rows }).catch((error) => ({ error }));
      if (response.error) return notify(response.error?.response?.data?.message || response.error.message || 'Import failed.');
      setWalletMeta((cur) => ({ ...cur, lifetime_patients_count: response.data?.lifetime_patients_count ?? lifetimeCount + rows.length }));
      setContacts((cur) => [...(Array.isArray(response.data?.data) ? response.data.data : []), ...cur]);
      notify('File import synced.');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (contact) => {
    const { error } = await supabase.from('patients_ledger').delete().eq('phone', contact.phone);
    if (error) return notify('Delete failed.');
    setContacts((cur) => cur.filter((c) => c.phone !== contact.phone));
  };

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen font-sans text-slate-900">
      <div className="max-w-6xl mx-auto space-y-8">
        {toast && <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{toast}</div>}

        <div className="flex items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl"><Users size={24}/></div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 italic">Patients</h1>
              <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${metricClass}`}>{metricText}</span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Patients Ledger</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><UserPlus size={16}/> Manual Adder</h3>
            <p className="text-xs text-slate-400">Name, phone and 12-hour appointment time.</p>
            <button disabled={isAtLimit} onClick={() => isAtLimit ? setIsUpgradeModalOpen(true) : setIsManualModalOpen(true)} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all disabled:bg-slate-300">Open Manual Adder</button>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><Plus size={16}/> Quick Adder</h3>
            <input disabled={isAtLimit} value={quickPatient.name} onChange={(e) => setQuickPatient({ ...quickPatient, name: e.target.value })} placeholder="Name" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none disabled:opacity-50" />
            <input disabled={isAtLimit} value={quickPatient.phone} onChange={(e) => setQuickPatient({ ...quickPatient, phone: e.target.value })} placeholder="10-digit phone" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none disabled:opacity-50" />
            <button disabled={isAtLimit} onClick={handleQuickAdd} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all disabled:bg-slate-300">Quick Add</button>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center"><UploadCloud size={24}/></div>
            <div>
              <h3 className="font-black text-sm">File Import Center</h3>
              <p className="text-xs text-slate-400 mt-1">Import CSV, XLS, or XLSX rows into patients_ledger.</p>
            </div>
            <label className={`w-full py-3 rounded-xl font-bold transition-all ${isAtLimit ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer'}`}>
              {importing ? 'Importing...' : 'Choose File'}
              <input disabled={isAtLimit} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => parseImportFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={22} />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search patient name or phone..." className="w-full pl-16 pr-6 py-5 bg-white border-2 border-slate-50 rounded-[2.5rem] outline-none font-medium text-lg placeholder:text-slate-300 focus:border-orange-200" />
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-50 text-[11px] uppercase text-slate-400 font-black tracking-[0.2em]">
                <th className="px-12 py-7">Name</th>
                <th className="px-12 py-7 text-center">Phone No</th>
                <th className="px-12 py-7 text-center">Appointment</th>
                <th className="px-12 py-7 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="4" className="p-32 text-center animate-pulse text-slate-300 font-black uppercase tracking-widest">Loading Data...</td></tr>
              ) : filteredContacts.length === 0 ? (
                <tr><td colSpan="4" className="p-32 text-center text-slate-300 font-black uppercase tracking-widest">List is Empty</td></tr>
              ) : filteredContacts.map((contact) => (
                <tr key={contact.id || contact.phone} className="group hover:bg-slate-50/50 transition-all">
                  <td className="px-12 py-6 font-bold text-slate-800 text-xl">{contact.name || 'Unknown'}</td>
                  <td className="px-12 py-6 text-center"><div className="inline-flex items-center gap-2 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 font-bold text-slate-600 tracking-wider"><Phone size={14} className="text-orange-500"/>{contact.phone}</div></td>
                  <td className="px-12 py-6 text-center font-bold text-slate-500">{contact.appointment_time || '-'}</td>
                  <td className="px-12 py-6 text-right"><button onClick={() => handleDelete(contact)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"><Trash2 size={20}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={handleManualSubmit} className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Manual Adder</h3>
              <button type="button" onClick={() => setIsManualModalOpen(false)} className="p-2 rounded-xl hover:bg-slate-100"><X size={18}/></button>
            </div>
            <input value={manualPatient.name} onChange={(e) => setManualPatient({ ...manualPatient, name: e.target.value })} placeholder="Patient Name" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required/>
            <input value={manualPatient.phone} onChange={(e) => setManualPatient({ ...manualPatient, phone: e.target.value })} placeholder="10-digit mobile number" className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none" required/>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <select value={manualTime.hour} onChange={(e) => setManualTime({ ...manualTime, hour: e.target.value })} className="rounded-xl bg-slate-50 p-3 text-sm font-bold outline-none">{Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h) => <option key={h}>{h}</option>)}</select>
              <select value={manualTime.minute} onChange={(e) => setManualTime({ ...manualTime, minute: e.target.value })} className="rounded-xl bg-slate-50 p-3 text-sm font-bold outline-none">{['00', '15', '30', '45'].map((m) => <option key={m}>{m}</option>)}</select>
              <select value={manualTime.period} onChange={(e) => setManualTime({ ...manualTime, period: e.target.value })} className="rounded-xl bg-slate-50 p-3 text-sm font-bold outline-none"><option>AM</option><option>PM</option></select>
            </div>
            <button type="submit" className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition-all">Add Patient</button>
          </form>
        </div>
      )}

      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-8 text-center shadow-2xl">
            <Lock className="mx-auto text-orange-600" size={38}/>
            <h3 className="mt-4 text-2xl font-black text-slate-950">Contact Limit Reached</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500">Upgrade to Growth or Hospital to keep adding lifetime contacts.</p>
            <button onClick={() => setIsUpgradeModalOpen(false)} className="mt-6 rounded-2xl bg-orange-600 px-6 py-3 text-sm font-black uppercase tracking-widest text-white">Upgrade Plan</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
