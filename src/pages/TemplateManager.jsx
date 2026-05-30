import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Trash2, ShieldCheck, AlertCircle, ExternalLink, Inbox, Globe, Copy, Wallet, Sparkles, Layers, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, X, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import api from '../utils/api';
import { calculateCampaignCost, getBaselineTemplatesForSpecialty, MEDICAL_SPECIALTIES } from '../constants/templateLibrary';
import { useWallet } from '../context/WalletContext'; // Import useWallet hook
import { useAuth } from '../context/AuthContext';

const TemplateManager = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncingStatuses, setIsSyncingStatuses] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [metaBusinessManagerId, setMetaBusinessManagerId] = useState('');
  const [planTier, setPlanTier] = useState('Starter Clinic');
  const [activeTab, setActiveTab] = useState('library');
  const [dashboardTemplates, setDashboardTemplates] = useState([]);
  const [dashboardSpecialization, setDashboardSpecialization] = useState('');
  const [bookingLink, setBookingLink] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [activeLang, setActiveLang] = useState('All');
  const [libraryPage, setLibraryPage] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editableBody, setEditableBody] = useState('');
  const [parsedVariables, setParsedVariables] = useState([]);
  const [variablesPayload, setVariablesPayload] = useState({});
  const [useMedia, setUseMedia] = useState(false);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [mediaType, setMediaType] = useState('IMAGE');
  const [submittingTemplate, setSubmittingTemplate] = useState(false);
  const [notice, setNotice] = useState(null);
  const templateApiPath = String(api.defaults?.baseURL || '').replace(/\/+$/, '').endsWith('/api') ? '/templates' : '/api/templates';
  const { wallet } = useWallet(); // Consume wallet from global context
  const { userProfile } = useAuth();
  const [selectedSpecialty, setSelectedSpecialty] = useState('General Physician');

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
      if (!userProfile?.meta_configured) {
        await fetchTemplates({ silent: true });
        return;
      }
      await api.get('/templates/sync', { params: { userId } });
      await fetchTemplates({ silent });
    } catch (err) {
      console.error('Template status sync failed:', err);
      if (!silent) setError('Unable to sync template statuses right now.');
    } finally {
      if (!silent) setIsSyncingStatuses(false);
    }
  }, [fetchTemplates, userProfile]);

  const fetchDashboardTemplates = useCallback(async () => {
    try {
      setLibraryLoading(true);
      const userId = localStorage.getItem('user_id');
      const params = {
        userId,
        ...(activeLang.toLowerCase() !== 'all' && { language: activeLang })
      };
      const response = await api.get('/templates/dashboard', { params });
      const specialization = response.data?.sourceSpecialization || response.data?.metadata?.sourceSpecialization || response.data?.specialization || userProfile?.clinic_category || userProfile?.specialization || localStorage.getItem('user_business_category') || 'General Physician';
      const templates = Array.isArray(response.data?.templates) ? response.data.templates : [];
      setDashboardTemplates(templates.length ? templates : getBaselineTemplatesForSpecialty(specialization));
      setDashboardSpecialization(specialization);
      setBookingLink(response.data?.bookingLink || userProfile?.booking_link || '');
      setError('');
    } catch (err) {
      console.error('Dashboard template library failed:', err);
      setError(err?.response?.data?.message || 'Unable to load specialization templates.');
      const specialization = userProfile?.clinic_category || userProfile?.specialization || localStorage.getItem('user_business_category') || 'General Physician';
      setDashboardTemplates(getBaselineTemplatesForSpecialty(specialization));
      setDashboardSpecialization(specialization);
    } finally {
      setLibraryLoading(false);
    }
  }, [activeLang, userProfile]);

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
  }, [fetchTemplates, syncAndRefreshTemplates]);

  useEffect(() => {
    setLibraryPage(0);
    fetchDashboardTemplates();
  }, [activeLang, fetchDashboardTemplates]);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (!userId || !supabase?.channel) return undefined;

    const channel = supabase
      .channel(`template-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_templates',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const updated = payload.new || {};
          setTemplates((current) => (
            Array.isArray(current)
              ? current.map((template) => template.id === updated.id ? { ...template, ...updated } : template)
              : current
          ));

          const status = String(updated.status || '').toUpperCase();
          if (['APPROVED', 'REJECTED'].includes(status)) {
            setNotice({
              type: status === 'APPROVED' ? 'success' : 'error',
              text: `${updated.template_name || 'Template'} is now ${status}.`
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const fetchMetaBusinessId = async () => {
      setMetaBusinessManagerId(
        userProfile?.meta_business_manager_id ||
        userProfile?.whatsapp_business_id ||
        ''
      );
    };

    fetchMetaBusinessId();
  }, [userProfile]);

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
      case 'PENDING_APPROVAL':
      case 'PENDING_REVIEW':
      case 'PENDING': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'DRAFT': return 'text-slate-600 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const openMetaTemplateManager = () => {
    const url = metaBusinessManagerId
      ? `https://business.facebook.com/wa/manage/templates/?business_id=${encodeURIComponent(metaBusinessManagerId)}`
      : 'https://business.facebook.com/wa/manage/templates/';
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (id) => {
    if (!id || !window.confirm("Are you sure? This will delete the template from your records and Meta.")) return;

    try {
      const userId = localStorage.getItem('user_id');
      await api.delete(`${templateApiPath}/${id}`, { params: { userId } });
      setTemplates((currentTemplates) => (
        Array.isArray(currentTemplates)
          ? currentTemplates.filter((template) => template?.id !== id)
          : []
      ));
      setError('');
    } catch (err) {
      console.error('Template delete failed:', err);
      setError(err?.response?.data?.message || 'Unable to delete this template from Meta.');
      await fetchTemplates({ silent: true });
    }
  };

  const handleSyncStatuses = async () => {
    await syncAndRefreshTemplates();
  };

  const languageTabs = ['All', 'Hinglish', 'Hindi', 'English'];
  const libraryTemplates = useMemo(() => {
    return Array.isArray(dashboardTemplates) ? dashboardTemplates : [];
  }, [dashboardTemplates]);
  const totalLibraryPages = Math.max(1, Math.ceil(libraryTemplates.length / 6));
  const visibleLibraryTemplates = useMemo(
    () => libraryTemplates.slice(libraryPage * 6, libraryPage * 6 + 6),
    [libraryTemplates, libraryPage]
  );
  const collectBodyPlaceholders = useCallback((text) => (
    [...String(text || '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)]
      .map((match) => Number(match[1]))
      .filter(Number.isFinite)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort((a, b) => a - b)
  ), []);

  const defaultSampleForPlaceholder = useCallback((index) => {
    if (index === 1) return 'Sample Patient';
    if (index === 2) return bookingLink || 'https://yogidesk-ai.com/book';
    return index === 3 ? '20' : `Sample ${index}`;
  }, [bookingLink]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const variables = editableBody.match(/\{\{\d+\}\}/g) || [];
    const uniqueVariables = [...new Set(variables)]
      .map((token) => Number(token.replace(/[{}]/g, '')))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    setParsedVariables(uniqueVariables);
    setVariablesPayload((current) => {
      const next = {};
      uniqueVariables.forEach((index) => {
        next[index] = current[index] || defaultSampleForPlaceholder(index);
      });
      return next;
    });
  }, [defaultSampleForPlaceholder, editableBody, selectedTemplate]);

  const bodyExampleValues = useMemo(
    () => parsedVariables.map((index) => variablesPayload[index] || ''),
    [parsedVariables, variablesPayload]
  );

  const metaExamples = useMemo(
    () => ({ body_text: bodyExampleValues.length ? [bodyExampleValues] : [[]] }),
    [bodyExampleValues]
  );

  const openTemplatePreview = (template) => {
    setSelectedTemplate(template);
    setEditableBody(template?.body_text || '');
    const placeholders = collectBodyPlaceholders(template?.body_text || '');
    setParsedVariables(placeholders);
    setVariablesPayload(Object.fromEntries(placeholders.map((index) => [index, defaultSampleForPlaceholder(index)])));
    setUseMedia(false);
    setMediaType('IMAGE');
    setMediaUrl('');
    setMediaFile(null);
    setIsDraggingMedia(false);
  };

  const closeTemplatePreview = () => {
    setSelectedTemplate(null);
    setEditableBody('');
    setParsedVariables([]);
    setVariablesPayload({});
    setUseMedia(false);
    setMediaUrl('');
    setMediaFile(null);
    setIsDraggingMedia(false);
  };

  const handleMediaFile = (file) => {
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Attach a JPEG or PNG image for the Meta template header.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setError('Media must be below 3MB for template submission.');
      return;
    }

    setMediaType('IMAGE');
    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setMediaUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleMediaUpload = (event) => {
    handleMediaFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const submitPremadeTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setSubmittingTemplate(true);
      const userId = localStorage.getItem('user_id');
      const payload = new FormData();
      payload.append('userId', userId || '');
      payload.append('templateId', selectedTemplate.id);
      payload.append('bodyText', editableBody || selectedTemplate.body_text || '');
      payload.append('language', selectedTemplate.language || 'English');
      payload.append('category', selectedTemplate.category || 'MARKETING');
      payload.append('variables', JSON.stringify(bodyExampleValues));
      payload.append('examples', JSON.stringify(metaExamples));
      payload.append('hasMedia', String(Boolean(useMedia && mediaFile)));
      payload.append('mediaType', mediaType);
      if (useMedia && mediaFile) payload.append('media', mediaFile);

      const response = await api.post('/templates/submit-to-meta', payload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setTemplates((current) => [response.data?.template, ...(Array.isArray(current) ? current : [])].filter(Boolean));
      setNotice({ type: 'success', text: response.data?.message || 'Template submitted to Meta for approval.' });
      closeTemplatePreview();
      setActiveTab('submitted');
    } catch (err) {
      console.error('Premade template submission failed:', err);
      setError(err?.response?.data?.message || 'Unable to submit this template to Meta.');
    } finally {
      setSubmittingTemplate(false);
    }
  };

  const templateRows = useMemo(() => Array.isArray(filteredTemplates) ? filteredTemplates : [], [filteredTemplates]);
  const parseButtons = (buttons) => {
    if (Array.isArray(buttons)) return buttons;
    try { return buttons ? JSON.parse(buttons) : []; } catch { return []; }
  };
  const submittedRows = useMemo(
    () => (templateRows || []).filter((template) => ['PENDING', 'PENDING_APPROVAL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'].includes(String(template?.status || '').toUpperCase())),
    [templateRows]
  );
  const submittedMetadata = useMemo(
    () => (submittedRows || []).map((template) => ({
      ...template,
      status: ['PENDING_REVIEW', 'PENDING_APPROVAL'].includes(String(template?.status || 'UNKNOWN').toUpperCase()) ? 'PENDING' : String(template?.status || 'UNKNOWN').toUpperCase(),
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
  }, [wallet.balance]);

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

      {activeTab === 'library' && <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Globe size={16} /> Ready-Made Library
            </h3>
            <p className="mt-2 text-xl font-black text-slate-900">{dashboardSpecialization || 'General Physician'} Templates</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">50 Meta-ready templates mapped from your clinic profile.</p>
          </div>

          <div className="flex w-full gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1 lg:w-auto">
            {languageTabs.map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`min-h-11 flex-1 rounded-xl px-4 text-xs font-black transition-all lg:flex-none ${activeLang === lang ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            {notice.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} className="ml-auto rounded-lg p-1 hover:bg-white/70"><X size={16} /></button>
          </div>
        )}

        {libraryLoading ? (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-500">Loading specialization templates...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleLibraryTemplates.map((libTemp) => (
                <div key={libTemp.id} className="flex min-h-[230px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-orange-200 hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tight ${libTemp.category === 'MARKETING' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {libTemp.category}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-tight text-slate-500">{libTemp.language}</span>
                      {libTemp.has_media && <span className="rounded-md bg-orange-50 px-2 py-1 text-[9px] font-black uppercase tracking-tight text-orange-600">MEDIA</span>}
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(libTemp.body_text || '')}
                      className="min-h-10 min-w-10 rounded-xl p-2 text-slate-300 transition-colors hover:bg-orange-50 hover:text-orange-500"
                      title="Copy template"
                    >
                      <Copy size={16} />
                    </button>
                  </div>

                  <h4 className="text-sm font-black text-slate-800">{libTemp.template_name}</h4>
                  <p className="mt-3 line-clamp-4 flex-1 text-sm font-medium leading-relaxed text-slate-500">{libTemp.body_text}</p>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] text-slate-400 font-bold uppercase">Unit Cost</span>
                      <span className="text-xs font-black text-slate-700">Rs. {libTemp.category?.toLowerCase() === 'marketing' ? '1.30' : '0.20'}</span>
                    </div>
                    <button
                      onClick={() => openTemplatePreview(libTemp)}
                      className="min-h-11 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-orange-600 active:scale-95"
                    >
                      Use / Submit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {visibleLibraryTemplates.length === 0 && (
              <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-12 text-center text-sm font-bold text-slate-400">No templates found for this language.</div>
            )}

            <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row">
              <button
                onClick={() => setLibraryPage((page) => Math.max(0, page - 1))}
                disabled={libraryPage === 0}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black uppercase text-slate-600 transition-all hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                Page {libraryPage + 1} of {totalLibraryPages} - Showing 6 at a time
              </span>
              <button
                onClick={() => setLibraryPage((page) => Math.min(totalLibraryPages - 1, page + 1))}
                disabled={libraryPage >= totalLibraryPages - 1}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black uppercase text-slate-600 transition-all hover:border-orange-200 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </>
        )}
      </div>}

      {/* Task 1 & 2: Specialization Library & Multi-Language Tabs */}
      {activeTab === '__legacy_library__' && <div className="space-y-4">
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
              <h4 className="font-bold text-slate-800 text-sm mb-2">{libTemp.template_name}</h4>
              <p className="text-xs text-slate-500 leading-relaxed min-h-[40px] mb-4">
                {activeLang === 'EN' ? libTemp.english : 
                 activeLang === 'HI' ? libTemp.hindi : 
                 libTemp.hinglish}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-400 font-bold uppercase">Unit Cost</span>
                  <span className="text-xs font-black text-slate-700">Rs. {libTemp.category?.toLowerCase() === 'marketing' ? '1.30' : '0.20'}</span>
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
                    <button
                      onClick={openMetaTemplateManager}
                      className="text-slate-400 hover:text-orange-600 p-2 hover:bg-orange-50 rounded-xl transition-all"
                    >
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

      {selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl sm:rounded-[2rem] sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Meta submission preview</p>
                <h3 className="mt-1 text-xl font-black text-slate-900">{selectedTemplate.template_name}</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">{selectedTemplate.category} - {selectedTemplate.language}</p>
              </div>
              <button onClick={closeTemplatePreview} className="min-h-11 min-w-11 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X size={18} className="mx-auto" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">Editable template body</label>
                <textarea
                  value={editableBody}
                  onChange={(event) => setEditableBody(event.target.value)}
                  rows={8}
                  className="min-h-[180px] w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold leading-relaxed text-slate-700 outline-none transition focus:border-orange-400 focus:ring-4 focus:ring-orange-50"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Dynamic placeholder mapping</p>
                  {parsedVariables.length === 0 ? (
                    <p className="mt-2 text-xs font-bold text-emerald-900">No variable placeholders found in this body.</p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {parsedVariables.map((index) => (
                        <label key={index} className="block">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">{`{{${index}}}`} Sample Value</span>
                          <input
                            type="text"
                            value={variablesPayload[index] || ''}
                            onChange={(event) => setVariablesPayload((current) => ({ ...current, [index]: event.target.value }))}
                            className="mt-1 min-h-11 w-full rounded-xl border border-emerald-200 bg-white px-3 text-xs font-bold text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                            placeholder={defaultSampleForPlaceholder(index)}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-800">Attach Image/Media</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !useMedia;
                        setUseMedia(next);
                        if (!next) {
                          setMediaFile(null);
                          setMediaUrl('');
                          setIsDraggingMedia(false);
                        }
                      }}
                      className={`relative h-7 w-12 rounded-full transition ${useMedia ? 'bg-orange-600' : 'bg-slate-200'}`}
                      aria-pressed={useMedia}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${useMedia ? 'left-6' : 'left-1'}`} />
                    </button>
                  </label>

                  {useMedia && (
                    <div className="mt-4 space-y-3">
                      <label
                        onDragOver={(event) => {
                          event.preventDefault();
                          setIsDraggingMedia(true);
                        }}
                        onDragLeave={() => setIsDraggingMedia(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          setIsDraggingMedia(false);
                          handleMediaFile(event.dataTransfer.files?.[0]);
                        }}
                        className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 text-center text-xs font-black uppercase transition ${isDraggingMedia ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-300 text-slate-500 hover:border-orange-300 hover:text-orange-600'}`}
                      >
                        <Upload size={18} />
                        Drag JPEG/PNG here or tap to upload
                        <span className="text-[10px] font-bold normal-case text-slate-400">Clinic branding image or healthcare banner</span>
                        <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleMediaUpload} />
                      </label>
                      {mediaUrl && (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <img src={mediaUrl} alt="Selected media preview" className="max-h-40 w-full object-cover" />
                          <div className="flex items-center justify-between gap-3 p-3 text-xs font-semibold text-slate-500">
                            <span className="truncate">{mediaFile?.name || 'Media selected'}</span>
                            <button type="button" onClick={() => { setMediaFile(null); setMediaUrl(''); }} className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-rose-600">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={closeTemplatePreview}
                className="min-h-12 rounded-xl border border-slate-200 px-5 text-xs font-black uppercase text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitPremadeTemplate}
                disabled={submittingTemplate || !editableBody.trim() || bodyExampleValues.some((value) => !String(value || '').trim()) || (useMedia && !mediaFile)}
                className="min-h-12 rounded-xl bg-orange-600 px-5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-100 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingTemplate ? 'Submitting...' : 'Submit to Meta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateManager;
