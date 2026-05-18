import React, { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Send, Users, Wallet } from 'lucide-react';
import api from '../utils/api';
import { supabase } from '../supabaseClient';
import { calculateMessageCost, getWallet } from '../utils/wallet';

const Campaigns = () => {
  const userId = localStorage.getItem('user_id');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');
  const [wallet] = useState(() => getWallet());

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const templateType = String(selectedTemplate?.category || 'utility').toLowerCase();
  const unitCost = calculateMessageCost(templateType, 1);
  const totalCost = Number((patients.length * unitCost).toFixed(2));
  const hasCredits = wallet.balance >= totalCost && totalCost > 0;

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  const lookupLedger = async (query = '') => {
    setLoading(true);
    const q = query.trim();
    let request = supabase.from('patients_ledger').select('*');
    if (q) request = supabase.from('patients_ledger').select('*').or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data } = await request;
    setPatients(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const fetchCampaignData = async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: ledger }, { data: approvedTemplates }] = await Promise.all([
      supabase.from('patients_ledger').select('*'),
      supabase.from('whatsapp_templates').select('id, template_name, category, language, body_content').eq('user_id', userId).eq('status', 'APPROVED').order('created_at', { ascending: false })
    ]);
    setPatients(Array.isArray(ledger) ? ledger : []);
    setTemplates(Array.isArray(approvedTemplates) ? approvedTemplates : []);
    setSelectedTemplateId((current) => current || approvedTemplates?.[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => { fetchCampaignData(); }, []);
  useEffect(() => {
    const timer = setTimeout(() => lookupLedger(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const startCampaign = async () => {
    if (!selectedTemplate) return notify('Select an approved template.');
    if (patients.length === 0) return notify('No patients found for this campaign.');
    if (!hasCredits) return notify('Insufficient Yogi Wallet balance.');
    setLoading(true);
    try {
      await api.post('/api/campaigns/schedule', {
        userId,
        template: selectedTemplate,
          recipients: patients.map((p) => ({
          name: p.name,
          phone: p.phone,
          appointment_time: p.appointment_time
        }))
      });
      notify('Campaign queued with 3-minute intervals.');
    } catch (error) {
      notify(error?.response?.data?.msg || 'Campaign scheduling failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 bg-[#fcfcfc] min-h-screen">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black">Campaign Manager</h1>
          <p className="mt-2 text-sm font-medium text-gray-500">Broadcast approved templates to patients from the synced ledger.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-slate-700 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Users size={14}/> Recipients</div>
            <div className="mt-1 text-2xl font-black">{patients.length}</div>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-white px-5 py-4 text-orange-700 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Wallet size={14}/> Deduction</div>
            <div className="mt-1 text-2xl font-black">Rs. {totalCost.toFixed(2)}</div>
          </div>
          <button onClick={fetchCampaignData} className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-slate-500 shadow-sm font-black flex items-center justify-center gap-2">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/> Refresh
          </button>
        </div>
      </div>

      {toast && <div className="mb-6 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{toast}</div>}
      {!hasCredits && totalCost > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <span>Wallet balance is low for this broadcast.</span>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm h-fit">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400">Approved Template</label>
          <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="mt-2 mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]">
            {templates.map((template) => <option key={template.id} value={template.id}>{template.template_name} · {template.category}</option>)}
          </select>

          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Filter patients by name or phone..." className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]" />

          <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            <div>Rate: <strong>Rs. {unitCost.toFixed(2)}</strong> / recipient</div>
            <div>Total Deduction: <strong>Rs. {totalCost.toFixed(2)}</strong></div>
          </div>

          <button onClick={startCampaign} disabled={loading || !hasCredits || !selectedTemplate || patients.length === 0} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all disabled:bg-gray-300">
            {loading ? 'Scheduling...' : <><Send size={18} /> START CAMPAIGN</>}
          </button>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 bg-slate-50/30 font-black text-xs uppercase tracking-widest">Ledger Recipients</div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-400 font-bold">
                <tr>
                  <th className="p-4">Patient</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Appointment</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id || p.phone} className="border-t border-gray-50">
                    <td className="p-4 font-bold">{p.name}</td>
                    <td className="p-4 text-gray-500">{p.phone}</td>
                    <td className="p-4 text-gray-500">{p.appointment_time || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && patients.length === 0 && <div className="p-16 text-center text-slate-300 font-black uppercase tracking-widest">No synced patients found</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
