import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Database, MoreVertical, RefreshCcw, Search, Shield, Users, Wallet } from 'lucide-react';
import api from '../../utils/api';

const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const dateLabel = (value) => value ? new Date(value).toLocaleString() : 'No activity';

const MetricPanel = ({ icon: Icon, label, value, detail }) => (
  <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
        <Icon size={22} />
      </div>
    </div>
    <p className="mt-3 text-sm font-semibold text-slate-500">{detail}</p>
  </div>
);

const SuperAdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [walletDraft, setWalletDraft] = useState({ userId: '', amount: '', reason: '' });

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [overviewResponse, usersResponse] = await Promise.all([
        api.get('/superadmin/overview'),
        api.get('/superadmin/users', { params: { search } }),
      ]);
      setOverview(overviewResponse.data?.data || null);
      setUsers(usersResponse.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.legalName, user.clinicName, user.email, user.mobile]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [search, users]);

  const toggleStatus = async (user) => {
    setActionId(user.id);
    try {
      const nextStatus = user.systemStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
      await api.patch(`/superadmin/users/${user.id}/status`, { status: nextStatus });
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, systemStatus: nextStatus } : item));
    } finally {
      setActionId('');
    }
  };

  const adjustWallet = async (event) => {
    event.preventDefault();
    if (!walletDraft.userId) return;
    setActionId(walletDraft.userId);
    try {
      const { data } = await api.post(`/superadmin/users/${walletDraft.userId}/wallet-adjustment`, {
        amount: Number(walletDraft.amount),
        reason: walletDraft.reason,
      });
      const nextBalance = data?.data?.balance;
      setUsers((current) => current.map((item) => item.id === walletDraft.userId ? { ...item, walletBalance: nextBalance } : item));
      setWalletDraft({ userId: '', amount: '', reason: '' });
    } finally {
      setActionId('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-600">Super Admin Control Dashboard</p>
            <h1 className="mt-2 text-3xl font-black">Owner Overview</h1>
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCcw size={17} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricPanel icon={Users} label="Total Registrations" value={overview?.totalRegistrations || 0} detail="Supabase Auth users excluding superadmin metadata." />
          <MetricPanel icon={Shield} label="Active Subscriptions" value={overview?.activeSubscriptions?.paid || 0} detail={`${overview?.activeSubscriptions?.trial || 0} free trial workspaces tracked.`} />
          <MetricPanel icon={Activity} label="Live Active Users" value={overview?.liveActiveUsers || 0} detail="Recent activity/session approximation from server activity streams." />
          <MetricPanel icon={AlertTriangle} label="Meta Compliance Health" value={overview?.metaComplianceHealth?.warningFlags || 0} detail="Aggregated template warning, failed, paused, or rejected flags." />
        </section>

        <section className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-black">Universal User Management Matrix</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Searchable owner audit of plans, wallets, clinical activity, AI usage, delivery reports, and login activity.</p>
            </div>
            <label className="relative block w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-orange-500"
                placeholder="Search doctors, clinics, email, mobile"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1500px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3">Doctor / Clinic</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3">Clinical Metrics</th>
                  <th className="px-4 py-3">AI Tokens</th>
                  <th className="px-4 py-3">WhatsApp Delivery</th>
                  <th className="px-4 py-3">Login Activity</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`border-b border-slate-100 align-top ${user.expiresSoon ? 'bg-red-50/70' : 'bg-white'}`}>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{user.legalName}</p>
                      <p className="mt-1 font-semibold text-slate-600">{user.clinicName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{user.email}</p>
                      <p className="text-xs font-semibold text-slate-500">{user.mobile || 'No mobile node'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-black uppercase text-white">{user.planTier}</span>
                      <p className="mt-2 text-xs font-bold text-slate-500">{user.subscriptionStatus}</p>
                      <p className={`mt-2 text-xs font-black ${user.expiresSoon ? 'text-red-600' : 'text-slate-500'}`}>
                        Expiry: {user.expiryDays === null ? 'Not set' : `${user.expiryDays} days`}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{dateLabel(user.expiryAt)}</p>
                    </td>
                    <td className="px-4 py-4 font-black text-emerald-600">{money(user.walletBalance)}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">Appointments: {user.appointments.total} | Pending: {user.appointments.pending} | Completed: {user.appointments.completed}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Patients: {user.totalPatients}</p>
                      <p className="text-xs font-semibold text-slate-500">Team: {user.teamCount}</p>
                    </td>
                    <td className="px-4 py-4 font-black text-blue-600">{Number(user.geminiTokens || 0).toLocaleString()}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">Sent: {user.delivery.totalSent}</p>
                      <p className="text-xs text-slate-500">Delivered: {user.delivery.delivered} | Read: {user.delivery.read} | Failed: {user.delivery.failed}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs font-bold text-slate-500">Last active</p>
                      <p className="mt-1 font-semibold">{dateLabel(user.lastActiveAt)}</p>
                      <p className="mt-1 text-xs text-slate-500">{user.activityDays?.slice(0, 4).join(', ') || 'No login log rows'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-44 flex-col gap-2">
                        <button
                          type="button"
                          disabled={actionId === user.id}
                          onClick={() => toggleStatus(user)}
                          className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black uppercase text-white ${user.systemStatus === 'SUSPENDED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-60`}
                        >
                          <MoreVertical size={14} />
                          {user.systemStatus === 'SUSPENDED' ? 'Reactivate' : 'Kill Switch'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWalletDraft({ userId: user.id, amount: '', reason: 'Superadmin manual wallet adjustment' })}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-black uppercase text-slate-700 hover:bg-slate-50"
                        >
                          <Wallet size={14} />
                          Adjust Wallet
                        </button>
                        <span className={`rounded-md px-2 py-1 text-center text-[11px] font-black ${user.systemStatus === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {user.systemStatus}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <Database size={18} />
            <p className="text-sm font-bold">Rows near plan expiry are softly highlighted red. Optional audit tables safely render zero values when unavailable.</p>
          </div>
        </section>
      </main>

      {walletDraft.userId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-6">
          <form onSubmit={adjustWallet} className="w-full max-w-md rounded-t-md bg-white p-5 shadow-2xl sm:rounded-md">
            <h3 className="text-xl font-black">Wallet Manual Adjustment</h3>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Amount</span>
              <input
                type="number"
                step="0.01"
                value={walletDraft.amount}
                onChange={(event) => setWalletDraft((current) => ({ ...current, amount: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-orange-500"
                placeholder="Use negative value to decrement"
                required
              />
            </label>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Reason</span>
              <input
                value={walletDraft.reason}
                onChange={(event) => setWalletDraft((current) => ({ ...current, reason: event.target.value }))}
                className="mt-2 w-full rounded-md border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-orange-500"
                required
              />
            </label>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setWalletDraft({ userId: '', amount: '', reason: '' })} className="flex-1 rounded-md border border-slate-200 px-4 py-3 font-black text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={actionId === walletDraft.userId} className="flex-1 rounded-md bg-[#FF6A00] px-4 py-3 font-black text-white disabled:opacity-60">
                Apply
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
