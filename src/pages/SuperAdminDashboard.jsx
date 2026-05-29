import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import { ShieldAlert, Users, Zap, Database, RefreshCcw, AlertCircle } from 'lucide-react';

const SuperAdminDashboard = () => {
  const [summary, setSummary] = useState({ activeClinicCount: 0, globalWalletBalance: 0, totalAutomationTraffic: 0 });
  const [clinics, setClinics] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [summaryResponse, clinicsResponse, transactionsResponse] = await Promise.all([
        api.get('/admin/summary'),
        api.get('/admin/clinics'),
        api.get('/admin/transactions')
      ]);

      setSummary(summaryResponse.data.data || {});
      setClinics(clinicsResponse.data.data || []);
      setTransactions(transactionsResponse.data.data || []);
    } catch (error) {
      console.error('Admin dashboard fetch error:', error?.response?.data || error.message || error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const toggleClinicStatus = async (clinic) => {
    setActionLoading(clinic.id);
    try {
      const newStatus = clinic.system_status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      const response = await api.patch(`/admin/clinics/${clinic.id}/status`, { status: newStatus });
      const updatedClinic = response.data.data;
      setClinics((prev) => prev.map((item) => item.id === clinic.id ? { ...item, system_status: updatedClinic.system_status } : item));
    } catch (error) {
      console.error('Failed to update clinic status:', error?.response?.data || error.message || error);
      alert('Unable to update clinic status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full border border-slate-700 flex items-center justify-center">
            <RefreshCcw className="animate-spin text-orange-400" size={32} />
          </div>
          <p className="text-slate-400">Loading admin control center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Owner Control Node</p>
          <h1 className="text-4xl font-black tracking-tight">Product Owner Dashboard</h1>
          <p className="text-slate-400 max-w-2xl mt-2">Secure clinic and payment analytics for Super Admin users only. All financial activity is displayed as read-only ledger activity.</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <ShieldAlert size={22} className="text-emerald-500" />
          <span className="text-sm">Strict Super Admin enforced</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Active Clinics</p>
              <p className="text-3xl font-semibold mt-3">{summary.activeClinicCount}</p>
            </div>
            <Users className="text-cyan-400" size={32} />
          </div>
          <p className="text-slate-500 text-sm">Clinics with active account status currently able to run automations.</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Platform Wallet Float</p>
              <p className="text-3xl font-semibold mt-3">₹{summary.globalWalletBalance.toLocaleString()}</p>
            </div>
            <span className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300"><Zap size={24} /></span>
          </div>
          <p className="text-slate-500 text-sm">Combined wallet balance held across all clinics.</p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-lg shadow-slate-950/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Automation Traffic</p>
              <p className="text-3xl font-semibold mt-3">{summary.totalAutomationTraffic}</p>
            </div>
            <Database className="text-fuchsia-400" size={32} />
          </div>
          <p className="text-slate-500 text-sm">Total message delivery volume seen in campaign analytics.</p>
        </div>
      </div>

      <section className="mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Clinic Management</h2>
            <p className="text-slate-500 text-sm">Suspend or reactivate clinics with a secure kill switch.</p>
          </div>
          <button onClick={loadAdminData} className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:bg-slate-800">
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-lg shadow-slate-950/20">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Clinic</th>
                <th className="px-5 py-4">Doctor</th>
                <th className="px-5 py-4">Wallet Balance</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Joined</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((clinic) => (
                <tr key={clinic.id} className="border-b border-slate-800 hover:bg-slate-900/80">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-100">{clinic.clinic_name}</div>
                    <div className="text-xs text-slate-500">{clinic.email}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-300">{clinic.name}</td>
                  <td className="px-5 py-4 text-emerald-300">₹{clinic.wallet_balance.toFixed(2)}</td>
                  <td className={`px-5 py-4 text-sm font-semibold ${clinic.system_status === 'SUSPENDED' ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {clinic.system_status}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{new Date(clinic.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4">
                    <button
                      disabled={actionLoading === clinic.id}
                      onClick={() => toggleClinicStatus(clinic)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${clinic.system_status === 'SUSPENDED' ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-rose-500 text-white hover:bg-rose-400'} ${actionLoading === clinic.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {actionLoading === clinic.id ? 'Updating...' : clinic.system_status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Read-only Transaction Ledger</h2>
            <p className="text-slate-500 text-sm">Latest wallet top-ups captured from payment gateway webhooks in immutable audit view.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-200">
            <AlertCircle className="text-orange-400" size={16} /> Read-only ledger
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-lg shadow-slate-950/20">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4">Transaction ID</th>
                <th className="px-5 py-4">Clinic / Doctor</th>
                <th className="px-5 py-4">Amount</th>
                <th className="px-5 py-4">Provider</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={`${tx.transaction_id}-${tx.created_at}`} className="border-b border-slate-800 hover:bg-slate-900/80">
                  <td className="px-5 py-4 font-medium text-slate-100">{tx.transaction_id}</td>
                  <td className="px-5 py-4 text-slate-300">
                    <div>{tx.clinic_name}</div>
                    <div className="text-xs text-slate-500">{tx.doctor_name}</div>
                  </td>
                  <td className="px-5 py-4 text-emerald-300">₹{tx.amount.toFixed(2)}</td>
                  <td className="px-5 py-4 uppercase text-slate-400">{tx.provider}</td>
                  <td className={`px-5 py-4 font-semibold ${tx.gateway_status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tx.gateway_status}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{new Date(tx.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default SuperAdminDashboard;