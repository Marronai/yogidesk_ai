import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, Check, Eye, Phone, Plus, RefreshCw, Search, Send, Sparkles, User, Users, Wallet, X } from 'lucide-react';
import api from '../utils/api';
import { supabase } from '../config/supabaseClient';
import { calculateMessageCost } from '../utils/wallet';

const toMoneyNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const Campaigns = () => {
  const userId = localStorage.getItem('user_id');
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [ledgerPatients, setLedgerPatients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateVariables, setTemplateVariables] = useState({});
  const [activeVariableKey, setActiveVariableKey] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState('');
  const [walletBalance, setWalletBalance] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickPatient, setQuickPatient] = useState({ name: '', phone: '' });
  const [senderPhoneId, setSenderPhoneId] = useState('');

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
  const remainingBalance = Number((walletBalance - totalCost).toFixed(2));
  const hasCredits = walletBalance >= totalCost && totalCost > 0;
  const missingVariableKeys = variableKeys.filter((key) => !String(templateVariables[key] || '').trim());

  const selectedRecipientKeys = useMemo(() => (
    new Set(patients.map((patient) => String(patient.id || patient.phone)))
  ), [patients]);
  const filteredLedgerPatients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const sorted = [...ledgerPatients].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
    if (!q) return sorted;
    return sorted.filter((patient) => (
      String(patient.name || '').toLowerCase().includes(q) || String(patient.phone || '').includes(q)
    ));
  }, [ledgerPatients, searchTerm]);
  const groupedLedgerPatients = useMemo(() => (
    filteredLedgerPatients.reduce((groups, patient) => {
      const first = String(patient.name || '').trim().charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(first) ? first : '#';
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(patient);
      return groups;
    }, {})
  ), [filteredLedgerPatients]);
  const ledgerGroupLetters = useMemo(() => (
    Object.keys(groupedLedgerPatients).sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
  ), [groupedLedgerPatients]);
  const allLedgerSelected = ledgerPatients.length > 0 && ledgerPatients.every((patient) => selectedRecipientKeys.has(String(patient.id || patient.phone)));

  const refreshWallet = async () => {
    try {
      const response = await api.get('/api/wallet/balance', { params: { userId } });
      if (response.data.success) {
        setWalletBalance(toMoneyNumber(response.data.balance));
      }
    } catch (err) {
      console.error('Wallet sync error:', err);
    }
  };

  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  const fetchLedgerPatients = async () => {
    if (!userId) return [];
    const { data } = await supabase
      .from('patients_ledger')
      .select('*')
      .eq('user_id', userId);
    return Array.isArray(data) ? data : [];
  };

  const fetchCampaignData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await api.get('/templates/sync', { params: { userId } });
    } catch (syncError) {
      console.warn('Campaign template sync skipped:', syncError?.response?.data || syncError.message || syncError);
    }
    const [{ data: approvedTemplates }, { data: profile }, ledgerRows] = await Promise.all([
      supabase.from('whatsapp_templates').select('id, template_name, category, language, body_content').eq('user_id', userId).eq('status', 'APPROVED').order('created_at', { ascending: false }),
      supabase.from('doctor_profiles').select('*').eq('id', userId).maybeSingle(),
      fetchLedgerPatients()
    ]);
    setPatients([]);
    setLedgerPatients(ledgerRows);
    setTemplates(Array.isArray(approvedTemplates) ? approvedTemplates : []);
    const phoneId = profile?.meta_phone_number_id || profile?.whatsapp_phone_number_id || '';
    setSenderPhoneId(phoneId);
    setSelectedTemplateId((current) => current || approvedTemplates?.[0]?.id || '');
    setLoading(false);
  };

  useEffect(() => {
    setPatients([]);
    setLedgerPatients([]);
    fetchCampaignData();
    refreshWallet();
  }, [userId]);

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

  const removeRecipient = (patient) => {
    setPatients((current) => current.filter((item) => !((item.id && patient.id && item.id === patient.id) || item.phone === patient.phone)));
  };

  const toggleRecipient = (patient) => {
    const selected = selectedRecipientKeys.has(String(patient.id || patient.phone));
    if (selected) removeRecipient(patient);
    else addRecipient(patient);
  };

  const toggleAllRecipients = () => {
    setPatients(allLedgerSelected ? [] : ledgerPatients);
  };

  const addQuickPatient = async (event) => {
    event.preventDefault();
    const cleanName = quickPatient.name.trim();
    const cleanPhone = quickPatient.phone.trim().replace(/\s+/g, '');
    if (!userId) return notify('Login session expired. Please sign in again.');
    if (!cleanName) return notify('Name is required.');
    if (cleanPhone.length !== 10 || !/^\d{10}$/.test(cleanPhone)) return notify('Please enter a valid 10-digit mobile number.');
    if (ledgerPatients.some((patient) => patient.phone === cleanPhone)) return notify('Duplicate phone skipped.');

    setLoading(true);
    try {
      const response = await api.post('/api/patients', {
        userId,
        user_id: userId,
        name: cleanName,
        phone: cleanPhone,
        appointment_time: null
      });
      const inserted = response.data?.data || { user_id: userId, name: cleanName, phone: cleanPhone, appointment_time: null };
      setLedgerPatients((current) => [inserted, ...current]);
      addRecipient(inserted);
      setQuickPatient({ name: '', phone: '' });
      setShowQuickAddModal(false);
      notify('Patient added to campaign ledger.');
    } catch (error) {
      notify(error?.response?.data?.message || error.message || 'Patient sync failed.');
    } finally {
      setLoading(false);
    }
  };

  const startCampaign = async () => {
    if (!selectedTemplate) return notify('Select an approved template.');
    if (patients.length === 0) return notify('No patients found for this campaign.');
    if (missingVariableKeys.length > 0) return notify(`Fill values for ${missingVariableKeys.map((key) => `{{${key}}}`).join(', ')}.`);
    if (!hasCredits) return notify('Insufficient Yogi Wallet balance.');
    setShowConfirmModal(true);
  };

  const confirmCampaign = async () => {
    if (!selectedTemplate || !hasCredits || missingVariableKeys.length > 0) return;
    setLoading(true);
    try {
      const response = await api.post('/api/campaigns/send', {
        userId,
        template: {
          ...selectedTemplate,
          variables: templateVariables,
          sender_phone: senderPhoneId || 'SYSTEM',
          whatsapp_phone_number_id: senderPhoneId || 'SYSTEM'
        },
        recipients: patients.map((p) => ({
          name: p.name,
          phone: p.phone,
          phone_number: p.phone,
          appointment_time: p.appointment_time
        }))
      });
      notify(response.data?.message || 'Campaign executed successfully.');
      setShowConfirmModal(false);
      setPatients([]);
      refreshWallet();
    } catch (error) {
      notify(error?.response?.data?.message || error?.response?.data?.msg || 'Campaign execution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#111827] p-4 sm:p-6 lg:h-[calc(100vh-80px)] lg:overflow-hidden">
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-green-600">Pre-Campaign Confirmation</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Review wallet deduction</h2>
              </div>
              <button type="button" onClick={() => setShowConfirmModal(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Template Name & Preview</div>
                <div className="mt-2 text-base font-black text-slate-900">{selectedTemplate?.template_name || 'Selected Template'}</div>
                <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-600">
                  {selectedTemplate?.body_content || ''}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Recipients</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{patients.length} Patients</div>
                </div>
                <div className="rounded-2xl border border-slate-100 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cost Per Message</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">Rs. {unitCost.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-orange-700">Estimated Total Cost</div>
                  <div className="mt-1 text-2xl font-black text-orange-700">Rs. {totalCost.toFixed(2)}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Wallet After Deduction</div>
                  <div className="mt-1 text-2xl font-black text-emerald-700">Rs. {remainingBalance.toFixed(2)}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm font-bold text-slate-600">
                Current Wallet Balance: <span className="text-slate-950">Rs. {walletBalance.toFixed(2)}</span>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span>Ensure you have enough balance before confirmation.</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button type="button" onClick={() => setShowConfirmModal(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={confirmCampaign} disabled={loading || !hasCredits} className="rounded-2xl bg-green-600 px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-green-100 hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {loading ? 'Sending...' : `Confirm & Deduct Wallet Balance (Rs. ${totalCost.toFixed(2)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={addQuickPatient} className="w-full max-w-md rounded-[2rem] border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF6B00]">Quick Adder</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Add Patient</h2>
              </div>
              <button type="button" onClick={() => setShowQuickAddModal(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input value={quickPatient.name} onChange={(event) => setQuickPatient((current) => ({ ...current, name: event.target.value }))} placeholder="Patient name" className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]" required />
              <input value={quickPatient.phone} onChange={(event) => setQuickPatient((current) => ({ ...current, phone: event.target.value }))} placeholder="10-digit phone" className="w-full rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]" required />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B00] py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-100 hover:bg-orange-600 disabled:bg-slate-300">
                <Plus size={16} /> Add Patient
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-black text-white">Campaign Manager</h1>
            <p className="mt-2 text-sm font-medium text-slate-300">Broadcast approved templates to patients from the synced ledger.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-slate-700 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Users size={14} /> Recipients</div>
              <div className="mt-1 text-2xl font-black">{patients.length}</div>
            </div>
            <div className="rounded-2xl border border-orange-100 bg-white px-5 py-4 text-orange-700 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Wallet size={14} /> Wallet Balance</div>
              <div className="mt-1 text-2xl font-black">Rs. {walletBalance.toFixed(2)}</div>
            </div>
            <button onClick={fetchCampaignData} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white px-5 py-4 font-black text-slate-500 shadow-sm">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {toast && <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{toast}</div>}
        {!hasCredits && totalCost > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
            <AlertCircle size={20} className="mt-0.5 shrink-0" />
            <span>Wallet balance is low for this broadcast.</span>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-visible lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="shrink-0">
              <label className="text-xs font-black uppercase tracking-widest text-gray-400">Approved Template</label>
              <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className="mt-2 mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm font-bold outline-none focus:border-[#FF6B00]">
                <option value="">Select Template</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.template_name} - {template.category}</option>)}
              </select>

              {selectedTemplate && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      <Eye size={14} /> Live Template Preview
                    </p>
                    <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-emerald-700 shadow-sm">
                      {selectedTemplate.language || 'en_US'}
                    </span>
                  </div>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-emerald-100 bg-white p-4 pr-2 text-sm font-semibold leading-7 text-slate-700">
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
              )}
            </div>

            <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="mb-3 shrink-0 text-[10px] font-black uppercase tracking-widest text-slate-400">Template Variables</p>
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                {selectedTemplate && variableKeys.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
                ) : selectedTemplate ? (
                  <p className="text-xs font-bold text-slate-500">No variables found in this template.</p>
                ) : (
                  <p className="text-xs font-bold text-slate-500">Select an approved template to configure variables.</p>
                )}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-xs font-semibold text-slate-500">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-orange-500" />
                  Preview me highlighted placeholder par click karo, phir matching value fill karo. Smart chips har patient ke actual ledger data se Meta ko final text bhejenge.
                </div>
              </div>
            </div>

            <div className="mt-4 shrink-0 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              <div>Rate: <strong>Rs. {unitCost.toFixed(2)}</strong> / recipient</div>
              <div>Total Deduction: <strong>Rs. {totalCost.toFixed(2)}</strong></div>
            </div>

            <button onClick={startCampaign} disabled={loading || !hasCredits || !selectedTemplate || patients.length === 0 || missingVariableKeys.length > 0} className="mt-4 flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-green-600 py-4 font-bold text-white transition-all hover:bg-green-700 disabled:bg-gray-300">
              {loading ? 'Scheduling...' : <><Send size={18} /> START CAMPAIGN</>}
            </button>
          </div>

          <div className="flex min-h-[620px] flex-col overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm lg:min-h-0">
            <div className="shrink-0 border-b border-gray-50 bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF6B00]">Phonebook Directory</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">A-Z Patient Selection</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="button" onClick={toggleAllRecipients} disabled={ledgerPatients.length === 0} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-[#FF6B00] hover:bg-orange-100 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-300">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${allLedgerSelected ? 'border-[#FF6B00] bg-[#FF6B00] text-white' : 'border-orange-200 bg-white text-transparent'}`}>
                      <Check size={13} />
                    </span>
                    Select All
                  </button>
                  <button type="button" onClick={() => setShowQuickAddModal(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-100 hover:bg-orange-600">
                    <Plus size={16} /> Add Patient
                  </button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search patient name or phone..." className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-bold outline-none focus:border-[#FF6B00]" />
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-500">
                  {patients.length} / {ledgerPatients.length} Selected
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 pr-2 sm:p-5 sm:pr-3">
              {loading && ledgerPatients.length === 0 ? (
                <div className="flex h-full min-h-72 items-center justify-center text-center text-slate-300">
                  <span className="font-black uppercase tracking-widest">Loading Patients...</span>
                </div>
              ) : ledgerGroupLetters.length === 0 ? (
                <div className="flex h-full min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-slate-300">
                  <span className="font-black uppercase tracking-widest">No Patients Found</span>
                </div>
              ) : (
                <div className="space-y-5">
                  {ledgerGroupLetters.map((letter) => (
                    <section key={letter}>
                      <div className="sticky top-0 z-10 mb-2 flex items-center gap-3 bg-white/95 py-2 backdrop-blur">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111827] text-sm font-black text-white">{letter}</div>
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{groupedLedgerPatients[letter].length} Patients</span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {groupedLedgerPatients[letter].map((patient) => {
                          const selected = selectedRecipientKeys.has(String(patient.id || patient.phone));
                          return (
                            <button
                              key={patient.id || patient.phone}
                              type="button"
                              onClick={() => toggleRecipient(patient)}
                              className={`flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                                selected
                                  ? 'border-orange-200 bg-orange-50 shadow-sm'
                                  : 'border-slate-100 bg-white hover:border-orange-200 hover:bg-slate-50'
                              }`}
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-[#FF6B00] bg-[#FF6B00] text-white' : 'border-slate-200 bg-slate-50 text-transparent'}`}>
                                <Check size={13} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black text-slate-900">{patient.name || 'Unknown Patient'}</span>
                                <span className="mt-1 flex min-w-0 items-center gap-1 truncate text-xs font-bold text-slate-500">
                                  <Phone size={12} className="shrink-0 text-[#FF6B00]" /> {patient.phone || '-'}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
