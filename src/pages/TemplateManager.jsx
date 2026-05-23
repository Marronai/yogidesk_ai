import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Trash2, ShieldCheck, AlertCircle, ExternalLink, Inbox, Globe, Copy, Wallet, ChevronDown, Sparkles, Layers, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import api from '../utils/api';
import { getTemplatesBySpecialty, calculateCampaignCost, MEDICAL_SPECIALTIES, PRICING_RULES } from "../constants/templateLibrary";
import { getWallet } from '../utils/wallet';

const TemplateManager = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingStatuses, setIsSyncingStatuses] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [planTier, setPlanTier] = useState('Starter Clinic');
  const [activeTab, setActiveTab] = useState('create');
  const templateApiPath = String(api.defaults?.baseURL || '').replace(/\/+$/, '').endsWith('/api') ? '/templates' : '/api/templates';

  // Specialization Logic
  const businessCategory = localStorage.getItem('user_business_category') || 'General Physician';

  const [selectedSpecialty, setSelectedSpecialty] = useState(
    MEDICAL_SPECIALTIES.find(s => s.toLowerCase() === businessCategory.toLowerCase()) || 'Diabetologist'
  );

  const libraryTemplates = useMemo(() => getTemplatesBySpecialty(selectedSpecialty), [selectedSpecialty]);
  const [activeLang, setActiveLang] = useState('EN');

  const fetchTemplates = useCallback(async ({ silent = false } = {}) => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        setLoading(false);
        return;
      }

      if (!silent) setSyncing(true);
      const response = await api.get(templateApiPath, { params: { userId } });
      setTemplates(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (err) {
      console.error('Template fetch failed:', err);
      if (!silent) setError('Unable to load templates at the moment.');
      setTemplates((current) => current || []);
    } finally {
      if (!silent) setSyncing(false);
      setLoading(false);
    }
  }, [templateApiPath]);

  const syncAndRefreshTemplates = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setIsSyncingStatuses(true);
      const userId = localStorage.getItem('user_id');
      await api.get('/templates/sync', { params: { userId } });
      await fetchTemplates({ silent });
    } catch (err) {
      console.error('Template status sync failed:', err);
      if (!silent) setError('Unable to sync template statuses right now.');
    } finally {
      if (!silent) setIsSyncingStatuses(false);
    }
  }, [fetchTemplates]);

  useEffect(() => {
    const fetchPlanData = async () => {
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      const { data, error } = await supabase
        .from('wallets')
        .select('plan_tier')
        .eq('user_id', userId)
        .single();
      
      if (!error && data?.plan_tier) setPlanTier(data.plan_tier);
    };

    fetchPlanData();
    fetchTemplates();
    syncAndRefreshTemplates({ silent: true });
    const intervalId = window.setInterval(() => {
      syncAndRefreshTemplates({ silent: true });
    }, 5 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [fetchTemplates, syncAndRefreshTemplates]);

  const planLimits = {
    'Starter Clinic': 20,
    'Growth Clinic': 50,
    'Hospital': 100,
    'Multi-Specialty Hospital': 100 // Compatibility with Pricing data
  };

  const currentLimit = planLimits[planTier] || 20;
  const isLimitReached = templates.length >= currentLimit;

  const handleCreateNew = () => {
    if (isLimitReached) {
      alert(`⚠️ Template Limit Reached!\n\nYour current plan (${planTier}) allows up to ${currentLimit} templates. Please upgrade to Growth or Hospital plan to unlock more ready-made clinical setups.`);
      return;
    }
    navigate('/templates/create');
  };

  // Filter Logic
  const filteredTemplates = useMemo(() => {
    const templateList = Array.isArray(templates) ? templates : [];
    const query = searchTerm.trim().toLowerCase();

    if (!query) return templateList;

    return (templateList || []).filter((template) =>
      String(template?.template_name || '').toLowerCase().includes(query)
    );
  }, [searchTerm, templates]);

  const getStatusColor = (status) => {
    switch (String(status || '').toUpperCase()) {
      case 'APPROVED': return 'text-green-700 bg-green-50 border-green-200';
      case 'REJECTED': return 'text-red-700 bg-red-50 border-red-200';
      case 'PENDING_REVIEW':
      case 'PENDING': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'DRAFT': return 'text-slate-600 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure? This will delete the template from your records and Meta.")) {
      setTemplates((currentTemplates) => (
        Array.isArray(currentTemplates)
          ? currentTemplates.filter((template) => template?.id !== id)
          : []
      ));
    }
  };

  const handleSyncStatuses = async () => {
    await syncAndRefreshTemplates();
  };

  const templateRows = Array.isArray(filteredTemplates) ? filteredTemplates : [];
  const parseButtons = (buttons) => {
    if (Array.isArray(buttons)) return buttons;
    try { return buttons ? JSON.parse(buttons) : []; } catch { return []; }
  };
  const submittedRows = useMemo(
    () => (templateRows || []).filter((template) => ['PENDING', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(String(template?.status || '').toUpperCase())),
    [templateRows]
  );
  const submittedMetadata = useMemo(
    () => (submittedRows || []).map((template) => ({
      ...template,
      status: String(template?.status || 'UNKNOWN').toUpperCase() === 'PENDING_REVIEW' ? 'PENDING' : String(template?.status || 'UNKNOWN').toUpperCase(),
      buttons: parseButtons(template?.buttons),
      headerType: template?.header_type || 'NONE',
      mediaUrl: template?.header_url || template?.media_url || ''
    })),
    [submittedRows]
  );
  const tabs = [
    { id: 'create', label: '➕ Create Template' },
    { id: 'library', label: '📚 Specialty Library' },
    { id: 'submitted', label: '🌐 Submitted Meta Templates' }
  ];

  // Task 3: Wallet Validation Interceptor
  const handleExecuteBroadcast = useCallback(async (template, patientCount = 1) => {
    const wallet = getWallet();
    const totalCost = calculateCampaignCost(patientCount, template.category);
    
    if (wallet.balance < totalCost) {
      alert(`❌ Insufficient Yogi Wallet Balance!\nYour balance: Rs. ${wallet.balance.toFixed(2)}\nRequired: Rs. ${totalCost}\n\nPlease recharge with at least ₹100 to execute this broadcast.`);
      return;
    }
    
    if (window.confirm(`Confirm Broadcast?\nTotal Cost: Rs. ${totalCost}\nThis will be deducted from your Yogi Wallet.`)) {
      // Logic to call API broadcast endpoint
      console.log('Executing broadcast for', template.name);
      // await api.post('/campaign/broadcast', { templateId: template.id, cost: totalCost });
    }
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-orange-600" /> Message Templates
          </h1>
          <p className="text-slate-500 text-sm font-medium">Manage and monitor your Meta-approved WhatsApp flows.</p>
          {syncing && <p className="mt-1 text-xs font-black uppercase tracking-widest text-orange-500">Syncing Meta templates...</p>}
        </div>
        
        <button 
          onClick={handleCreateNew} 
          className={`${isLimitReached ? 'bg-slate-400' : 'bg-orange-600 hover:bg-orange-700'} text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-orange-100 active:scale-95 font-bold text-sm uppercase tracking-wider`}
        >
          <Plus size={18} />
          Create New Template
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 mb-6 gap-4">
        <div className="flex space-x-6 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-black whitespace-nowrap transition-all ${activeTab === tab.id ? 'text-orange-600 border-b-2 border-orange-600' : 'text-slate-400 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <button 
          onClick={handleSyncStatuses}
          disabled={isSyncingStatuses}
          className="flex items-center gap-2 px-4 py-2 sm:mb-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:border-orange-200 hover:text-orange-600 transition-all shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={12} className={isSyncingStatuses ? 'animate-spin' : ''} />
          {isSyncingStatuses ? 'Syncing...' : 'Sync Status'}
        </button>
      </div>

      {/* Security Tip */}
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
        <AlertCircle className="text-blue-500 shrink-0" size={20} />
        <p className="text-xs text-blue-700 leading-relaxed">
          <b>Policy Notice:</b> Templates marked as <span className="font-bold">REJECTED</span> cannot be sent to users. You must edit them to follow WhatsApp's Commerce Policy before re-submitting.
        </p>
      </div>

      {/* Plan Limit Notification Banner */}
      {isLimitReached && (
        <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6 rounded-[2rem] text-white shadow-xl shadow-orange-100 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <Sparkles className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight text-white">Template Limit Reached!</h3>
              <p className="text-orange-50 text-sm font-medium">Upgrade to Growth or Hospital plan to unlock more ready-made clinical setups.</p>
            </div>
          </div>
          <button onClick={() => navigate('/pricing')} className="bg-white text-orange-600 px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-50 transition-all">Upgrade Plan</button>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-black text-slate-900">Create WhatsApp Template</h2>
            <p className="text-sm text-slate-500 mt-2 font-medium">Build a Meta-ready message with header media, body variables, footer, and CTA buttons.</p>
          </div>
          <button
            onClick={handleCreateNew}
            disabled={isLimitReached}
            className={`${isLimitReached ? 'bg-slate-400' : 'bg-orange-600 hover:bg-orange-700'} text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-100 active:scale-95 font-bold text-sm uppercase tracking-wider`}
          >
            <Layers size={18} />
            Open Builder
          </button>
        </div>
      )}

      {/* Task 1 & 2: Specialization Library & Multi-Language Tabs */}
      {activeTab === 'library' && <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Globe size={16} /> Ready-Made Library
            </h3>
            {/* Specialization Dropdown */}
            <div className="relative group/select">
              <select 
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="appearance-none bg-slate-100 border-none text-[10px] font-black uppercase px-3 py-1.5 pr-8 rounded-lg text-slate-600 cursor-pointer focus:ring-2 focus:ring-orange-200 outline-none transition-all"
              >
                {MEDICAL_SPECIALTIES.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['EN', 'HI', 'HINGLISH'].map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${activeLang === lang ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {lang === 'HI' ? 'हिंदी' : lang}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {libraryTemplates.map((libTemp) => (
            <div key={libTemp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-orange-200 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tight ${libTemp.category === 'MARKETING' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                  {libTemp.category}
                </span>
                <button className="text-slate-300 hover:text-orange-500 transition-colors">
                  <Copy size={14} />
                </button>
              </div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">{libTemp.title}</h4>
              <p className="text-xs text-slate-500 leading-relaxed min-h-[40px] mb-4">
                {activeLang === 'EN' ? libTemp.english : 
                 activeLang === 'HI' ? libTemp.hindi : 
                 libTemp.hinglish}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Unit Cost</span>
                  <span className="text-xs font-black text-slate-700">₹{(PRICING_RULES[libTemp.category] || PRICING_RULES.UTILITY).toFixed(2)}</span>
                </div>
                <button 
                  onClick={() => handleExecuteBroadcast(libTemp)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all flex items-center gap-2"
                >
                  <Wallet size={12} /> Use Now
                </button>
              </div>
            </div>
          ))}
          <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 group hover:border-orange-200 hover:bg-orange-50 transition-all cursor-pointer" onClick={() => navigate('/templates/create')}>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-orange-100 group-hover:text-orange-600 transition-all mb-2">
              <Plus size={20} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Custom Template</span>
          </div>
        </div>
      </div>}

      {activeTab === 'submitted' && <div className="pt-2">
        <div className="relative group mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={20} />
          <input 
            type="text" 
            placeholder="Search submitted templates..." 
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-500 transition-all shadow-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Submitted Meta Templates</h3>
      {/* Table Section */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Template Info</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Status</th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submittedMetadata?.map((template, index) => (
                <tr key={template?.id || template?.template_name || index} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 text-slate-500 rounded-xl group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{template?.template_name || 'Untitled template'}</div>
                        <div className="text-[10px] text-slate-400 font-black uppercase">
                          {template?.language || 'Unknown language'} · {template.headerType}{template.mediaUrl ? ' · Media attached' : ''}{template.buttons?.length ? ` · ${template.buttons.length} buttons` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className="text-[11px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-lg uppercase tracking-tight">
                      {template?.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1.5 rounded-full text-[10px] font-black border ${getStatusColor(template?.status)}`}>
                      {template?.status || 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="p-5 text-right flex justify-end gap-2">
                    {/* View Details/Edit Action */}
                    <button className="text-slate-400 hover:text-orange-600 p-2 hover:bg-orange-50 rounded-xl transition-all">
                      <ExternalLink size={18} />
                    </button>
                    {/* Delete Action */}
                    <button 
                      onClick={() => handleDelete(template?.id)}
                      disabled={!template?.id}
                      className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {loading && (
            <div className="p-20 text-center text-slate-500">Loading templates...</div>
          )}
          {!loading && !error && submittedMetadata.length === 0 && (
            <div className="p-20 text-center">
              <div className="bg-orange-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5">
                <Inbox className="text-orange-300" size={34} />
              </div>
              <p className="text-slate-800 font-black text-lg">
                {searchTerm ? 'No matching templates' : 'No templates yet'}
              </p>
              <p className="text-slate-400 font-semibold text-sm mt-2">
                {searchTerm ? 'Try a different search term.' : 'Create your first WhatsApp template to see it here.'}
              </p>
            </div>
          )}
          {error && (
            <div className="p-6 text-center text-rose-600 font-semibold">{error}</div>
          )}
        </div>
      </div>
      </div>}
    </div>
  );
};

export default TemplateManager;
