import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, Eye, RefreshCw, Send, Sparkles, User, Users, Wallet } from 'lucide-react';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';
import { calculateMessageCost, getWallet } from '../utils/wallet';

const Campaigns = () => {
  const userId = localStorage.getItem('user_id');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [ledgerMatches, setLedgerMatches] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});
  const [activeVariableKey, setActiveVariableKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);

  const selectedTemplate = templates.find((t) => String(t.id) === String(selectedTemplateId));
  const variableKeys = Array.from(new Set(
    String(selectedTemplate?.body_content || '').match(/\{\{(\d+)\}\}/g)?.map((token) => token.replace(/[{}]/g, '')) || []
  )).sort((a, b) => Number(a) - Number(b));
  const firstRecipient = patients[0] || {};
  const smartFields = [
    { key: 'patient.name', label: 'Patient name', icon: User },
    { key: 'patient.phone', label: 'Patient phone', icon: Users },
    { key: 'patient.appointment_time', label: 'Appointment time', icon: CalendarClock },
    { key: 'today', label: 'Today', icon: CalendarClock }
  ];
  const formatSmartToken = (key) => `[[${key}]]`;
  const isSmartToken = (value) => /^\[\[[a-z._]+\]\]$/i.test(String(value || '').trim());
  const smartFieldLabel = (value) => {
    const fieldKey = String(value || '').replace(/^\[\[|\]\]$/g, '');
    return smartFields.find((field) => field.key === fieldKey)?.label || value;
  };
  const smartPreviewValue = (value) => {
    const fieldKey = String(value || '').replace(/^\[\[|\]\]$/g, '');
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const sampleMap = {
      'patient.name': firstRecipient.name || 'Patient name',
      'patient.phone': firstRecipient.phone || 'Patient phone',
      'patient.appointment_time': firstRecipient.appointment_time || 'Appointment time',
      today
    };
    return sampleMap[fieldKey] || smartFieldLabel(value);
  };
  const getVariableContext = (key) => {
    const body = String(selectedTemplate?.body_content || '');
    const token = `{{${key}}}`;
    const index = body.indexOf(token);
    if (index < 0) return token;
    const before = body.slice(Math.max(0, index - 34), index).replace(/\s+/g, ' ').trim();
    const after = body.slice(index + token.length, index + token.length + 34).replace(/\s+/g, ' ').trim();
    return `${before ? `${before} ` : ''}${token}${after ? ` ${after}` : ''}`;
  };
  const previewParts = useMemo(() => {
    const body = String(selectedTemplate?.body_content || '');
    if (!body) return [];
    return body.split(/(\{\{\d+\}\})/g).filter(Boolean).map((part) => {
      const match = part.match(/^\{\{(\d+)\}\}$/);
      if (!match) return { type: 'text', text: part };
      const key = match[1];
      const value = String(templateVariables[key] || '').trim();
      return {
        type: 'variable',
        key,
        token: part,
        value,
        preview: value ? (isSmartToken(value) ? smartPreviewValue(value) : value) : part,
        isActive: String(activeVariableKey) === String(key)
      };
    });
  }, [activeVariableKey, selectedTemplate?.body_content, templateVariables, patients]);
  const templateType = String(selectedTemplate?.category || 'utility').toLowerCase();
  const unitCost = calculateMessageCost(templateType, 1);
  const totalCost = Number((patients.length * unitCost).toFixed(2));
  const hasCredits = walletBalance >= totalCost && totalCost > 0;
  const missingVariableKeys = variableKeys.filter((key) => !String(templateVariables[key] || '').trim());

  const refreshWallet = async () => {
    try {
      const response = await api.get('/api/wallet/balance', { params: { userId } });
      if (response.data.success) {
        setWalletBalance(response.data.balance);
      }
    } catch (err) {
      console.error("Wallet sync error:", err);
    }
  };

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  const lookupLedger = async (query = '') => {
    const q = query.trim();
    if (!q) {
      setLedgerMatches([]);
      return;
    }

    setLoading(true);
    let request = supabase
      .from('patients_ledger')
      .select('*')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`);

    if (userId) request = request.eq('user_id', userId);

    const { data } = await request;
    setLedgerMatches(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const fetchCampaignData = async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: approvedTemplates }] = await Promise.all([
      supabase.from('whatsapp_templates').select('id, template_name, category, language, body_content').eq('user_id', userId).eq('status', 'APPROVED').order('created_at', { ascending: false })
    ]);
    setPatients([]);
    setLedgerMatches([]);
    setTemplates(Array.isArray(approvedTemplates) ? approvedTemplates : []);
    setSelectedTemplateId((current) => current || approvedTemplates?.[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => {
    setPatients([]);
    setLedgerMatches([]);
    fetchCampaignData();
    refreshWallet();
  }, [userId]);
  useEffect(() => {
    const timer = setTimeout(() => lookupLedger(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setTemplateVariables((current) => {
      const next = {};
      variableKeys.forEach((key) => {
        next[key] = current[key] || '';
      });
      return next;
    });
    setActiveVariableKey(variableKeys[0] || '');
  }, [selectedTemplateId, selectedTemplate?.body_content]);

  const addRecipient = (patient) => {
    setPatients((current) => {
      const exists = current.some((item) => (item.id && item.id === patient.id) || item.phone === patient.phone);
      return exists ? current : [...current, patient];
    });
  };

  const startCampaign = async () => {
    if (!selectedTemplate) return notify('Select an approved template.');
    if (patients.length === 0) return notify('No patients found for this campaign.');
    if (missingVariableKeys.length > 0) return notify(`Fill values for ${missingVariableKeys.map((key) => `{{${key}}}`).join(', ')}.`);
    if (!hasCredits) return notify('Insufficient Yogi Wallet balance.');
    setLoading(true);
    try {
      await api.post('/api/campaigns/schedule', {
        userId,
        template: {
          ...selectedTemplate,
          variables: templateVariables
        },
        recipients: patients.map((p) => ({
          name: p.name,
          phone: p.phone,
          appointment_time: p.appointment_time
        }))
      });
      notify('Campaign queued with 3-minute intervals.');
      refreshWallet();
    } catch (error) {
      notify(error?.response?.data?.msg || 'Campaign scheduling failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fcfcfc] p-4 sm:p-6 lg:p-10">
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
            <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Wallet size={14}/> Wallet Balance</div>
            <div className="mt-1 text-2xl font-black">₹{walletBalance.toFixed(2)}</div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm h-fit">
          <label className="text-xs font-black uppercase tracking-widest text-gray-400">Approved Template</label>
          <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="mt-2 mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]">
            <option value="">Select Template</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.template_name} · {template.category}</option>)}
          </select>

          {selectedTemplate && (
            <div className="mb-5 space-y-4">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    <Eye size={14} /> Live Template Preview
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-emerald-700 shadow-sm">
                    {selectedTemplate.language || 'en_US'}
                  </span>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white p-4 text-sm font-semibold leading-7 text-slate-700">
                  {previewParts.map((part, index) => (
                    part.type === 'variable' ? (
                      <button
                        key={`${part.token}-${index}`}
                        type="button"
                        onClick={() => setActiveVariableKey(part.key)}
                        className={`mx-0.5 rounded-lg border px-2 py-1 align-baseline font-black transition-all ${
                          part.isActive
                            ? 'border-orange-300 bg-orange-100 text-orange-700 ring-4 ring-orange-100'
                            : part.value
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                        title={`Edit ${part.token}`}
                      >
                        {part.preview}
                      </button>
                    ) : (
                      <span key={`text-${index}`}>{part.text}</span>
                    )
                  ))}
                </div>
                {activeVariableKey && (
                  <p className="mt-3 text-xs font-bold text-emerald-800">
                    Editing <span className="text-orange-700">{`{{${activeVariableKey}}}`}</span>: {getVariableContext(activeVariableKey)}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Template Variables</p>
              {variableKeys.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {variableKeys.map((key) => (
                    <div key={key} className={`rounded-2xl border bg-white p-3 transition-all ${String(activeVariableKey) === String(key) ? 'border-orange-300 ring-4 ring-orange-100' : 'border-gray-200'}`}>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {`Value for {{${key}}}`}
                      </label>
                      <input
                        value={isSmartToken(templateVariables[key]) ? smartFieldLabel(templateVariables[key]) : templateVariables[key] || ''}
                        onFocus={() => setActiveVariableKey(key)}
                        onChange={(e) => setTemplateVariables((current) => ({ ...current, [key]: e.target.value }))}
                        placeholder={getVariableContext(key)}
                        className="w-full rounded-xl border border-gray-100 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {smartFields.map((field) => {
                          const Icon = field.icon;
                          return (
                            <button
                              key={field.key}
                              type="button"
                              onClick={() => {
                                setActiveVariableKey(key);
                                setTemplateVariables((current) => ({ ...current, [key]: formatSmartToken(field.key) }));
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] font-black text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              <Icon size={11} /> {field.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs font-bold text-slate-500">No variables found in this template.</p>
              )}
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-xs font-semibold text-slate-500">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-orange-500" />
                Preview me highlighted placeholder par click karo, phir matching value fill karo. Smart chips har patient ke actual ledger data se Meta ko final text bhejenge.
              </div>
              </div>
            </div>
          )}

          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Filter patients by name or phone..." className="mb-5 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]" />

          <div className="mb-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            <div>Rate: <strong>Rs. {unitCost.toFixed(2)}</strong> / recipient</div>
            <div>Total Deduction: <strong>Rs. {totalCost.toFixed(2)}</strong></div>
          </div>

          <button onClick={startCampaign} disabled={loading || !hasCredits || !selectedTemplate || patients.length === 0 || missingVariableKeys.length > 0} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all disabled:bg-gray-300">
            {loading ? 'Scheduling...' : <><Send size={18} /> START CAMPAIGN</>}
          </button>
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 bg-slate-50/30 font-black text-xs uppercase tracking-widest">Selected Recipients</div>
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

          {ledgerMatches.length > 0 && (
            <div className="border-t border-slate-100 p-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Search Results</p>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {ledgerMatches.map((patient) => (
                  <button
                    key={patient.id || patient.phone}
                    type="button"
                    onClick={() => addRecipient(patient)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm hover:border-orange-200 hover:bg-orange-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-black text-slate-800">{patient.name}</span>
                      <span className="block truncate text-xs font-semibold text-slate-500">{patient.phone}</span>
                    </span>
                    <span className="shrink-0 text-xs font-black text-orange-600">Add</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
