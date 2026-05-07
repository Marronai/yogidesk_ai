import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Trash2, ShieldCheck, AlertCircle, ExternalLink, Inbox } from 'lucide-react';
import api from '../utils/api';

const normalizeTemplates = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.templates)) return payload.templates;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const TemplateManager = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data } = await api.get('/templates');
        setTemplates(normalizeTemplates(data));
      } catch (err) {
        console.error('Template fetch failed:', err);
        setError('Unable to load templates at the moment.');
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // Filter Logic
  const filteredTemplates = useMemo(() => {
    const templateList = Array.isArray(templates) ? templates : [];
    const query = searchTerm.trim().toLowerCase();

    if (!query) return templateList;

    return templateList.filter((template) =>
      String(template?.name || '').toLowerCase().includes(query)
    );
  }, [searchTerm, templates]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'PENDING': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'REJECTED': return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'DRAFT': return 'text-slate-600 bg-slate-50 border-slate-200';
      default: return 'text-slate-600 bg-slate-50';
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

  const templateRows = Array.isArray(filteredTemplates) ? filteredTemplates : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="text-orange-600" /> Message Templates
          </h1>
          <p className="text-slate-500 text-sm font-medium">Manage and monitor your Meta-approved WhatsApp flows.</p>
        </div>
        
        {/* FIXED: Ab yeh button Templates.jsx par le jayega */}
        <button 
          onClick={() => navigate('/templates/create')} 
          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-orange-100 active:scale-95 font-bold text-sm uppercase tracking-wider"
        >
          <Plus size={18} />
          Create New Template
        </button>
      </div>

      {/* Security Tip */}
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
        <AlertCircle className="text-blue-500 shrink-0" size={20} />
        <p className="text-xs text-blue-700 leading-relaxed">
          <b>Policy Notice:</b> Templates marked as <span className="font-bold">REJECTED</span> cannot be sent to users. You must edit them to follow WhatsApp's Commerce Policy before re-submitting.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={20} />
        <input 
          type="text" 
          placeholder="Search by template name..." 
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-orange-50 focus:border-orange-500 transition-all shadow-sm font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

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
              {templateRows?.map((template, index) => (
                <tr key={template?.id || template?.name || index} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-100 text-slate-500 rounded-xl group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{template?.name || 'Untitled template'}</div>
                        <div className="text-[10px] text-slate-400 font-black uppercase">{template?.language || 'Unknown language'}</div>
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
          {!loading && !error && templateRows.length === 0 && (
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
    </div>
  );
};

export default TemplateManager;
