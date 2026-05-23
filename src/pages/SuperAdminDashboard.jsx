import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { ShieldAlert, Users, Zap, AlertTriangle } from 'lucide-react';

const SuperAdminDashboard = () => {
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/metrics-summary')
      .then(res => setMetrics(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-red-500/20 rounded-2xl border border-red-500/50 text-red-500">
          <ShieldAlert size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tighter">CORE CONTROL CENTER</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">SaaS Owner Analytical Node</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {metrics.map(doc => (
          <div key={doc.id} className={`p-6 rounded-3xl border transition-all ${doc.is_breached ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-slate-900 border-slate-800'}`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg">{doc.name}</h3>
                <p className="text-slate-500 text-sm">{doc.email}</p>
              </div>
              {doc.is_breached && <AlertTriangle className="text-red-500" size={20} />}
            </div>
            
            <div className="space-y-3 mt-6">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Usage Status</span>
                <span className={doc.is_breached ? 'text-red-500' : 'text-emerald-500'}>{doc.actual_count} / {doc.limit_threshold}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${doc.is_breached ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((doc.actual_count / doc.limit_threshold) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;