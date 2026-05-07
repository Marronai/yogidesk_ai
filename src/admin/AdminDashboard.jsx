import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../utils/api';

const statusStyles = {
  Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Expired: 'bg-red-50 text-red-700 border-red-200',
  'Expiring Soon': 'bg-orange-50 text-orange-700 border-orange-200',
};

const formatDate = (date) => {
  if (!date) return 'No payment';
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return 'No payment';

  return parsedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));
};

const AdminDashboard = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingClientId, setUpdatingClientId] = useState(null);

  const fetchClients = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.get(`${API_URL}/api/admin/clients-all`, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true,
      });
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (err) {
      console.error('Admin clients fetch failed:', err);
      setError(err.response?.data?.msg || 'Unable to load client data.');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return clients;

    return clients.filter((client) => (
      String(client?.name || '').toLowerCase().includes(query) ||
      String(client?.email || '').toLowerCase().includes(query)
    ));
  }, [clients, searchTerm]);

  const summary = useMemo(() => {
    return clients.reduce((acc, client) => {
      acc.total += 1;
      acc.revenue += Number(client?.amount || 0);
      if (client?.status === 'Active') acc.active += 1;
      if (client?.status === 'Expiring Soon') acc.expiring += 1;
      if (client?.status === 'Expired') acc.expired += 1;
      return acc;
    }, { total: 0, revenue: 0, active: 0, expiring: 0, expired: 0 });
  }, [clients]);

  const toggleAccess = async (client) => {
    const nextValue = !client.isSubscribed;
    setUpdatingClientId(client.id);

    try {
      const token = localStorage.getItem('admin_token');
      const { data } = await axios.patch(
        `${API_URL}/api/admin/clients/${client.id}/access`,
        { enabled: nextValue },
        {
          headers: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        }
      );

      setClients((currentClients) => currentClients.map((currentClient) => (
        currentClient.id === client.id ? data.client : currentClient
      )));
    } catch (err) {
      alert(err.response?.data?.msg || 'Unable to update client access.');
    } finally {
      setUpdatingClientId(null);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50/40 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-orange-100">
          <div className="grid gap-6 p-6 lg:grid-cols-[280px_1fr] lg:p-8">
            <aside className="rounded-3xl bg-orange-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-600">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-100">Yogi Desk</p>
                  <h1 className="text-xl font-black">Admin Panel</h1>
                </div>
              </div>
              <div className="mt-8 space-y-3 text-sm font-bold">
                <div className="rounded-2xl bg-white px-4 py-3 text-orange-700">Client Overview</div>
                <div className="rounded-2xl bg-orange-500/60 px-4 py-3 text-orange-50">Access Control</div>
                <div className="rounded-2xl bg-orange-500/60 px-4 py-3 text-orange-50">Subscriptions</div>
              </div>
            </aside>

            <section className="flex flex-col justify-between gap-8">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-orange-300">Professional Dashboard</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Client subscriptions at a glance</h2>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                  Monitor payment dates, 30-day subscription cycles, revenue, and client access from one secure admin view.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl bg-white/10 p-5">
                  <Users className="text-orange-300" size={22} />
                  <p className="mt-4 text-2xl font-black">{summary.total}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Clients</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-5">
                  <CheckCircle2 className="text-emerald-300" size={22} />
                  <p className="mt-4 text-2xl font-black">{summary.active}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Active</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-5">
                  <Clock3 className="text-orange-300" size={22} />
                  <p className="mt-4 text-2xl font-black">{summary.expiring}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Expiring Soon</p>
                </div>
                <div className="rounded-3xl bg-white/10 p-5">
                  <p className="text-sm font-black text-orange-300">INR</p>
                  <p className="mt-4 text-2xl font-black">{formatCurrency(summary.revenue)}</p>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Revenue</p>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="rounded-[2rem] border border-orange-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-950">Client Overview</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">30-day subscription cycle calculated from last payment date.</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm font-bold outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-100 sm:w-72"
                />
              </div>
              <button
                type="button"
                onClick={fetchClients}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 transition hover:bg-orange-700"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="bg-orange-50/70">
                  <tr>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Client Name</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Email</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Payment Date</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Amount</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Days Left</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500">Status</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest text-slate-500 text-right">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan="7" className="p-12 text-center">
                        <Loader2 className="mx-auto animate-spin text-orange-600" size={28} />
                        <p className="mt-3 text-sm font-bold text-slate-500">Loading clients...</p>
                      </td>
                    </tr>
                  ) : filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-12 text-center text-sm font-bold text-slate-400">
                        No clients found.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.id} className="transition hover:bg-orange-50/30">
                        <td className="p-4">
                          <div className="font-black text-slate-900">{client.name || 'Unnamed Client'}</div>
                        </td>
                        <td className="p-4 text-sm font-semibold text-slate-500">{client.email || 'No email'}</td>
                        <td className="p-4 text-sm font-bold text-slate-700">{formatDate(client.paymentDate)}</td>
                        <td className="p-4 text-sm font-black text-slate-900">{formatCurrency(client.amount)}</td>
                        <td className="p-4">
                          <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                            {client.daysLeft} days
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[client.status] || statusStyles.Expired}`}>
                            {client.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => toggleAccess(client)}
                            disabled={updatingClientId === client.id}
                            className={`inline-flex min-w-32 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-xs font-black transition ${
                              client.isSubscribed
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            } disabled:opacity-60`}
                          >
                            {updatingClientId === client.id && <Loader2 className="animate-spin" size={14} />}
                            {client.isSubscribed ? 'Suspend' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
