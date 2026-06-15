import React, { Component, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  KeyRound,
  LogOut,
  RefreshCcw,
  Search,
  Shield,
  ShieldAlert,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { supabase } from '../../config/supabaseClient';

const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const dateLabel = (value) => value ? new Date(value).toLocaleString() : 'No activity';
const isRecentlyOnline = (value) => {
  const stamp = new Date(value || '').getTime();
  return Number.isFinite(stamp) && Date.now() - stamp <= 15 * 60 * 1000;
};

const tabs = [
  { id: 'overview', label: 'Overview & Active Users', icon: Activity },
  { id: 'profiles', label: 'User Profiling Cards', icon: Users },
  { id: 'staff', label: 'Staff Delegation & OTP Matrix', icon: Shield },
];

const PERMISSION_OPTIONS = [
  { key: 'can_view_universal_matrix', label: 'Allow Read-Only User Profiles' },
  { key: 'can_override_plan_wallet', label: 'Allow Wallet and AI Token Adjustment Overrides' },
  { key: 'can_use_kill_switch', label: 'Allow Kill-Switch Execution Privileges' },
  { key: 'can_manage_meta_compliance', label: 'Allow Master Key Ghost Impersonation' },
];
const emptyPermissions = {
  can_view_owner_overview: true,
  can_view_universal_matrix: false,
  can_override_plan_wallet: false,
  can_manage_meta_compliance: false,
  can_use_kill_switch: false,
};

class DashboardBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Super admin dashboard render failed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-md border border-amber-400 bg-slate-950 p-6 text-white">
          <p className="text-xs font-black uppercase tracking-widest text-amber-300">Dashboard Guard</p>
          <h2 className="mt-2 text-2xl font-black">The control surface hit a render fault.</h2>
          <p className="mt-2 text-sm font-semibold text-slate-300">Refresh the dashboard after the current operation settles.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const MetricPanel = ({ icon: Icon, label, value, detail }) => (
  <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0284c7] text-white">
        <Icon size={22} />
      </div>
    </div>
    <p className="mt-3 text-sm font-semibold text-slate-500">{detail}</p>
  </div>
);

const StatusBadge = ({ online, lastActiveAt }) => (
  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
    <span className={`h-2.5 w-2.5 rounded-full ${online ? 'animate-pulse bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)]' : 'bg-slate-400'}`} />
    {online ? 'Online' : `Offline | Last seen: ${dateLabel(lastActiveAt)}`}
  </span>
);

const ToggleSwitch = ({ checked, disabled, onChange }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onChange}
    className={`relative h-8 w-14 rounded-full border transition ${checked ? 'border-red-500 bg-red-600' : 'border-emerald-500 bg-emerald-600'} disabled:opacity-60`}
    aria-pressed={checked}
  >
    <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${checked ? 'left-7' : 'left-1'}`} />
  </button>
);

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const downloadCsv = (filename, rows) => {
  const body = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [walletDraft, setWalletDraft] = useState({ userId: '', amount: '', reason: '' });
  const [tokenDraft, setTokenDraft] = useState({ userId: '', delta: '', reason: '' });
  const [ghostDraft, setGhostDraft] = useState({ user: null, masterKey: '', error: '' });
  const [superadminContext, setSuperadminContext] = useState({ isOwner: false, permissions: emptyPermissions });
  const [internalStaff, setInternalStaff] = useState([]);
  const [staffDraft, setStaffDraft] = useState({ name: '', email: '', mobile: '', permissions: emptyPermissions });
  const [staffMessage, setStaffMessage] = useState('');

  const permissions = superadminContext.permissions || emptyPermissions;
  const canViewOverview = Boolean(permissions.can_view_owner_overview);
  const canViewMatrix = Boolean(permissions.can_view_universal_matrix);
  const canAdjustWallet = Boolean(permissions.can_override_plan_wallet);
  const canUseKillSwitch = Boolean(permissions.can_use_kill_switch);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: meData } = await api.get('/superadmin/me');
      const nextPermissions = meData?.permissions || emptyPermissions;
      const isOwner = Boolean(meData?.isOwner);
      setSuperadminContext({ isOwner, permissions: nextPermissions });

      const [overviewResponse, usersResponse, staffResponse] = await Promise.all([
        nextPermissions.can_view_owner_overview ? api.get('/superadmin/overview') : Promise.resolve({ data: { data: null } }),
        nextPermissions.can_view_universal_matrix ? api.get('/superadmin/users') : Promise.resolve({ data: { data: [] } }),
        isOwner ? api.get('/superadmin/staff/list') : Promise.resolve({ data: { data: [] } }),
      ]);
      setOverview(overviewResponse.data?.data || null);
      setUsers(usersResponse.data?.data || []);
      setInternalStaff(staffResponse.data?.data || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || 'Unable to load super admin dashboard.');
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

  const syncUserPatch = (userId, patch) => {
    setUsers((current) => current.map((item) => item.id === userId ? { ...item, ...patch } : item));
    setSelectedUser((current) => current?.id === userId ? { ...current, ...patch } : current);
  };

  const logout = async () => {
    setActionId('logout');
    try {
      delete api.defaults.headers.common.Authorization;
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      ['token', 'user_id', 'user_email', 'clinic_id', 'clinic_name', 'user_role', 'sb-access-token'].forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      sessionStorage.removeItem('yogidesk_superadmin_shadow');
      document.cookie.split(';').forEach((cookie) => {
        const name = cookie.split('=')[0]?.trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
      });
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

  const toggleStatus = async (user) => {
    if (!canUseKillSwitch) return;
    setActionId(`status-${user.id}`);
    try {
      const nextBlocked = !user.isBlocked;
      const { data } = await api.patch(`/superadmin/users/${user.id}/status`, { isBlocked: nextBlocked });
      syncUserPatch(user.id, {
        isBlocked: nextBlocked,
        systemStatus: data?.data?.systemStatus || (nextBlocked ? 'SUSPENDED' : 'ACTIVE'),
      });
    } finally {
      setActionId('');
    }
  };

  const adjustWallet = async (event) => {
    event.preventDefault();
    if (!walletDraft.userId || !canAdjustWallet) return;
    setActionId(`wallet-${walletDraft.userId}`);
    try {
      const { data } = await api.post(`/superadmin/users/${walletDraft.userId}/wallet-adjustment`, {
        amount: Number(walletDraft.amount),
        reason: walletDraft.reason,
      });
      syncUserPatch(walletDraft.userId, {
        walletBalance: data?.data?.balance,
        walletBalanceLabel: money(data?.data?.balance),
      });
      setWalletDraft({ userId: '', amount: '', reason: '' });
    } finally {
      setActionId('');
    }
  };

  const adjustTokens = async (event) => {
    event.preventDefault();
    if (!tokenDraft.userId || !canAdjustWallet) return;
    setActionId(`tokens-${tokenDraft.userId}`);
    try {
      const { data } = await api.post(`/superadmin/users/${tokenDraft.userId}/ai-token-adjustment`, {
        delta: Number(tokenDraft.delta),
        reason: tokenDraft.reason,
      });
      syncUserPatch(tokenDraft.userId, { aiMessageBalance: data?.data?.aiMessageBalance });
      setTokenDraft({ userId: '', delta: '', reason: '' });
    } finally {
      setActionId('');
    }
  };

  const submitGhostLogin = async (event) => {
    event.preventDefault();
    if (!ghostDraft.user?.email || !ghostDraft.masterKey) return;
    setActionId(`ghost-${ghostDraft.user.id}`);
    setGhostDraft((current) => ({ ...current, error: '' }));
    try {
      const { data } = await api.post('/auth/master-key-login', {
        email: ghostDraft.user.email,
        masterKey: ghostDraft.masterKey,
      });
      const token = data?.token || data?.session?.access_token;
      if (!token || !data?.user?.id) throw new Error('Ghost login session was not issued.');
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      sessionStorage.setItem('yogidesk_superadmin_shadow', JSON.stringify(data));
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user_id', data.user.id);
      sessionStorage.setItem('clinic_name', data.clinic?.name || ghostDraft.user.clinicName || 'Clinic Workspace');
      localStorage.setItem('token', token);
      localStorage.setItem('user_id', data.user.id);
      localStorage.setItem('clinic_name', data.clinic?.name || ghostDraft.user.clinicName || 'Clinic Workspace');
      localStorage.setItem('user_role', 'doctor');
      window.location.assign('/dashboard');
    } catch (ghostError) {
      setGhostDraft((current) => ({
        ...current,
        error: ghostError.response?.data?.message || ghostError.message || 'Unable to complete Ghost Login.',
      }));
    } finally {
      setActionId('');
    }
  };

  const inviteInternalStaff = async (event) => {
    event.preventDefault();
    setActionId('staff-invite');
    setStaffMessage('');
    try {
      const { data } = await api.post('/superadmin/staff/invite', staffDraft);
      setInternalStaff((current) => [data?.data, ...current.filter((item) => item?.email !== data?.data?.email)].filter(Boolean));
      setStaffDraft({ name: '', email: '', mobile: '', permissions: emptyPermissions });
      setStaffMessage(data?.message || 'Staff OTP simulation tracker generated.');
    } catch (staffError) {
      setStaffMessage(staffError.response?.data?.message || 'Unable to save internal staff permissions.');
    } finally {
      setActionId('');
    }
  };

  const exportLedger = (user) => {
    const rows = [
      ['Date', 'Type', 'Amount', 'Description'],
      ...(user.transactions || []).map((row) => [dateLabel(row.created_at), row.transaction_type || row.type, row.amount, row.description]),
    ];
    downloadCsv(`${user.clinicName || 'clinic'}-full-ledger.csv`, rows);
  };

  const exportWallet = (user) => {
    const rows = [
      ['Date', 'Wallet Change', 'Balance Metadata', 'Description'],
      ...(user.transactions || []).map((row) => [dateLabel(row.created_at), row.amount, JSON.stringify(row.metadata || {}), row.description]),
    ];
    downloadCsv(`${user.clinicName || 'clinic'}-wallet-history.csv`, rows);
  };

  return (
    <DashboardBoundary>
      <div className="min-h-screen bg-slate-100 text-slate-950 lg:flex">
        <aside className="sticky top-0 z-30 flex h-auto w-full flex-col justify-between border-r border-slate-900 bg-slate-950 text-white lg:h-screen lg:w-64">
          <div className="p-5">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#0284c7] text-white">
                <ShieldAlert size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#eab308]">YogiDesk</p>
                <h1 className="text-lg font-black">Super Admin</h1>
              </div>
            </div>
            <nav className="mt-5 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm font-black transition ${active ? 'bg-[#0284c7] text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="border-t border-white/10 p-5">
            <button
              type="button"
              onClick={logout}
              disabled={actionId === 'logout'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#eab308] px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              <LogOut size={18} />
              Log Out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#0284c7]">Matte Black Control Surface</p>
                <h2 className="mt-2 text-3xl font-black">Super Admin Dashboard</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative block sm:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-[#0284c7]"
                    placeholder="Search doctors, clinics, email, mobile"
                  />
                </label>
                <button
                  type="button"
                  onClick={loadDashboard}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
                >
                  <RefreshCcw size={17} className={loading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </div>
            </div>
            {error && <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">{error}</p>}
          </header>

          <div className="space-y-6 px-4 py-6 sm:px-6">
            {activeTab === 'overview' && (
              <>
                {canViewOverview && (
                  <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricPanel icon={Users} label="Total Registrations" value={overview?.totalRegistrations || 0} detail="Doctor auth users and mapped profiles." />
                    <MetricPanel icon={Shield} label="Active Subscriptions" value={overview?.activeSubscriptions?.paid || 0} detail={`${overview?.activeSubscriptions?.trial || 0} trial workspaces tracked.`} />
                    <MetricPanel icon={Activity} label="Live Active Users" value={overview?.liveActiveUsers || 0} detail="Recent session and activity approximation." />
                    <MetricPanel icon={AlertTriangle} label="Meta Warnings" value={overview?.metaComplianceHealth?.warningFlags || 0} detail="Rejected, paused, disabled, or failed templates." />
                  </section>
                )}

                {canViewMatrix && (
                  <section className="rounded-md border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-4">
                      <h3 className="text-xl font-black">Live Contact Matrix</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">Doctor contact nodes with real-time online indicators.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-[960px] text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-950 text-[11px] font-black uppercase tracking-widest text-white">
                          <tr>
                            <th className="px-4 py-3">Doctor Name</th>
                            <th className="px-4 py-3">Clinic/Hospital Name</th>
                            <th className="px-4 py-3">Registered Email</th>
                            <th className="px-4 py-3">Mobile</th>
                            <th className="px-4 py-3">Live Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((user) => (
                            <tr key={user.id} className="border-b border-slate-100 bg-white">
                              <td className="px-4 py-4 font-black">{user.legalName}</td>
                              <td className="px-4 py-4 font-semibold text-slate-700">{user.clinicName}</td>
                              <td className="px-4 py-4 text-slate-600">{user.email || 'Not registered'}</td>
                              <td className="px-4 py-4 text-slate-600">{user.mobile || 'No mobile node'}</td>
                              <td className="px-4 py-4"><StatusBadge online={isRecentlyOnline(user.lastActiveAt)} lastActiveAt={user.lastActiveAt} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </>
            )}

            {activeTab === 'profiles' && canViewMatrix && (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {filteredUsers.map((user) => {
                  const online = isRecentlyOnline(user.lastActiveAt);
                  return (
                    <button
                      type="button"
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className="rounded-md border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#0284c7] hover:shadow-lg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-black text-slate-950">{user.clinicName}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">{user.legalName}</p>
                        </div>
                        <span className="rounded-md bg-slate-950 px-2 py-1 text-xs font-black uppercase text-white">{user.planTier}</span>
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3">
                        <StatusBadge online={online} lastActiveAt={user.lastActiveAt} />
                        <span className={`rounded-md px-2 py-1 text-[11px] font-black ${user.isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {user.systemStatus}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </section>
            )}

            {activeTab === 'staff' && superadminContext.isOwner && (
              <section className="rounded-md border border-slate-900 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/20">
                <div className="border-b border-white/10 pb-5">
                  <p className="text-xs font-black uppercase tracking-widest text-[#eab308]">Staff Management</p>
                  <h3 className="mt-2 text-2xl font-black">Add New Corporate Operator/Staff</h3>
                </div>

                <form onSubmit={inviteInternalStaff} className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
                  <div className="space-y-4">
                    {[
                      ['name', 'Staff Name', 'Staff Name', 'text'],
                      ['email', 'Email', 'staff@email.com', 'email'],
                      ['mobile', 'Mobile', '+91 99999 99999', 'tel'],
                    ].map(([key, label, placeholder, type]) => (
                      <label key={key} className="block">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
                        <input
                          type={type}
                          value={staffDraft[key]}
                          onChange={(event) => setStaffDraft((current) => ({ ...current, [key]: event.target.value }))}
                          className="mt-2 w-full rounded-md border border-white/15 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-[#eab308]"
                          placeholder={placeholder}
                          required={key !== 'mobile'}
                        />
                      </label>
                    ))}
                    <button
                      type="submit"
                      disabled={actionId === 'staff-invite'}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0284c7] px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-sky-700 disabled:opacity-60"
                    >
                      <UserPlus size={18} />
                      Dispatch OTP Tracker
                    </button>
                    {staffMessage && <p className="rounded-md border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-sm font-bold text-amber-100">{staffMessage}</p>}
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {PERMISSION_OPTIONS.map((option) => (
                      <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-white/15 bg-black/60 p-4 transition hover:border-[#eab308]">
                        <input
                          type="checkbox"
                          checked={Boolean(staffDraft.permissions[option.key])}
                          onChange={(event) => setStaffDraft((current) => ({
                            ...current,
                            permissions: { ...current.permissions, [option.key]: event.target.checked },
                          }))}
                          className="mt-1 h-4 w-4 accent-[#eab308]"
                        />
                        <span className="text-sm font-black text-white">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </form>

                {internalStaff.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {internalStaff.slice(0, 9).map((member) => (
                      <div key={member.id || member.email} className="rounded-md border border-white/15 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-white">{member.name}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-400">{member.email}</p>
                            {member.mobile && <p className="text-xs font-semibold text-slate-400">{member.mobile}</p>}
                          </div>
                          <span className="rounded-md bg-[#eab308]/15 px-2 py-1 text-[11px] font-black uppercase text-amber-300">{member.status || 'INVITED'}</span>
                        </div>
                        <div className="mt-3 space-y-1">
                          {PERMISSION_OPTIONS.filter((option) => member[option.key]).map((option) => (
                            <p key={option.key} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                              <CheckCircle2 size={13} className="text-[#eab308]" />
                              {option.label}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>

        {selectedUser && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4">
            <div className="mx-auto my-6 max-w-5xl rounded-md border border-slate-800 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#0284c7]">Profile Override Overlay</p>
                  <h3 className="mt-2 text-2xl font-black">{selectedUser.clinicName}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{selectedUser.legalName} | {selectedUser.email}</p>
                </div>
                <button type="button" onClick={() => setSelectedUser(null)} className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
                <MetricPanel icon={Bot} label="Remaining AI Messages" value={Number(selectedUser.aiMessageBalance || 0).toLocaleString('en-IN')} detail={`${Number(selectedUser.aiMessagesUsed || 0).toLocaleString('en-IN')} messages consumed.`} />
                <MetricPanel icon={Wallet} label="Last Recharge Value" value={selectedUser.lastRechargeValueLabel || money(selectedUser.lastRechargeValue)} detail="Latest positive ledger value." />
                <MetricPanel icon={Shield} label="Active Current Plan" value={selectedUser.planTier || 'Trial'} detail={selectedUser.subscriptionStatus || 'unknown'} />
                <MetricPanel icon={Clock3} label="Plan Expiry Countdown" value={selectedUser.expiryDays === null ? 'Not set' : `${selectedUser.expiryDays}d`} detail={dateLabel(selectedUser.expiryAt)} />
              </div>

              <div className="grid grid-cols-1 gap-3 border-y border-slate-200 bg-slate-50 p-5 md:grid-cols-2">
                <button type="button" onClick={() => exportLedger(selectedUser)} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0284c7] px-4 py-3 text-sm font-black text-white hover:bg-sky-700">
                  <Download size={18} />
                  Download Full Ledger Transaction CSV
                </button>
                <button type="button" onClick={() => exportWallet(selectedUser)} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0284c7] px-4 py-3 text-sm font-black text-white hover:bg-sky-700">
                  <Download size={18} />
                  Download Wallet History CSV
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
                <button type="button" disabled={!canAdjustWallet} onClick={() => setWalletDraft({ userId: selectedUser.id, amount: '', reason: 'Superadmin manual wallet adjustment' })} className="rounded-md border border-slate-200 p-4 text-left transition hover:border-[#0284c7] disabled:opacity-50">
                  <Wallet className="text-[#0284c7]" />
                  <p className="mt-3 font-black">Adjust Wallet Balance</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Add or deduct funds directly.</p>
                </button>
                <button type="button" disabled={!canAdjustWallet} onClick={() => setTokenDraft({ userId: selectedUser.id, delta: '', reason: 'Superadmin manual AI token pack adjustment' })} className="rounded-md border border-slate-200 p-4 text-left transition hover:border-[#0284c7] disabled:opacity-50">
                  <Bot className="text-[#0284c7]" />
                  <p className="mt-3 font-black">Adjust AI Token Pack</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Apply numeric credit modifier.</p>
                </button>
                <div className="rounded-md border border-slate-200 p-4">
                  <ShieldAlert className={selectedUser.isBlocked ? 'text-red-600' : 'text-emerald-600'} />
                  <p className="mt-3 font-black">Kill Switch Toggle</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-slate-500">{selectedUser.isBlocked ? 'Blocked' : 'Active'}</span>
                    <ToggleSwitch checked={selectedUser.isBlocked} disabled={!canUseKillSwitch || actionId === `status-${selectedUser.id}`} onChange={() => toggleStatus(selectedUser)} />
                  </div>
                </div>
                <button type="button" onClick={() => setGhostDraft({ user: selectedUser, masterKey: '', error: '' })} className="rounded-md border border-slate-200 p-4 text-left transition hover:border-[#eab308]">
                  <KeyRound className="text-[#eab308]" />
                  <p className="mt-3 font-black">Ghost Login</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Requires Admin Master Password.</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {ghostDraft.user && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-6">
            <form onSubmit={submitGhostLogin} className="w-full max-w-md rounded-t-md border border-[#eab308]/40 bg-slate-950 p-5 text-white shadow-2xl sm:rounded-md">
              <KeyRound className="text-[#eab308]" />
              <h3 className="mt-3 text-xl font-black">Ghost Login Authorization</h3>
              <p className="mt-1 text-sm font-semibold text-slate-400">{ghostDraft.user.legalName} | {ghostDraft.user.email}</p>
              <label className="mt-5 block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Admin Master Password</span>
                <input
                  type="password"
                  value={ghostDraft.masterKey}
                  onChange={(event) => setGhostDraft((current) => ({ ...current, masterKey: event.target.value, error: '' }))}
                  className="mt-2 w-full rounded-md border border-white/15 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-[#eab308]"
                  autoComplete="off"
                  required
                />
              </label>
              {ghostDraft.error && <p className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-100">{ghostDraft.error}</p>}
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setGhostDraft({ user: null, masterKey: '', error: '' })} className="flex-1 rounded-md border border-white/15 px-4 py-3 font-black text-slate-300">Cancel</button>
                <button type="submit" disabled={actionId === `ghost-${ghostDraft.user.id}`} className="flex-1 rounded-md bg-[#0284c7] px-4 py-3 font-black text-white disabled:opacity-60">
                  <Eye size={16} className="inline" /> Enter
                </button>
              </div>
            </form>
          </div>
        )}

        {walletDraft.userId && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
            <form onSubmit={adjustWallet} className="w-full max-w-md rounded-t-md bg-white p-5 shadow-2xl sm:rounded-md">
              <h3 className="text-xl font-black">Wallet Manual Adjustment</h3>
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Amount</span>
                <input type="number" step="0.01" value={walletDraft.amount} onChange={(event) => setWalletDraft((current) => ({ ...current, amount: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-[#0284c7]" placeholder="Use negative value to decrement" required />
              </label>
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Reason</span>
                <input value={walletDraft.reason} onChange={(event) => setWalletDraft((current) => ({ ...current, reason: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-[#0284c7]" required />
              </label>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setWalletDraft({ userId: '', amount: '', reason: '' })} className="flex-1 rounded-md border border-slate-200 px-4 py-3 font-black text-slate-600">Cancel</button>
                <button type="submit" disabled={actionId === `wallet-${walletDraft.userId}`} className="flex-1 rounded-md bg-[#0284c7] px-4 py-3 font-black text-white disabled:opacity-60">Apply</button>
              </div>
            </form>
          </div>
        )}

        {tokenDraft.userId && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6">
            <form onSubmit={adjustTokens} className="w-full max-w-md rounded-t-md bg-white p-5 shadow-2xl sm:rounded-md">
              <h3 className="text-xl font-black">AI Token Pack Adjustment</h3>
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Credit Modifier</span>
                <input type="number" step="1" value={tokenDraft.delta} onChange={(event) => setTokenDraft((current) => ({ ...current, delta: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-[#0284c7]" placeholder="Use negative value to deduct" required />
              </label>
              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Reason</span>
                <input value={tokenDraft.reason} onChange={(event) => setTokenDraft((current) => ({ ...current, reason: event.target.value }))} className="mt-2 w-full rounded-md border border-slate-200 px-4 py-3 font-semibold outline-none focus:border-[#0284c7]" required />
              </label>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setTokenDraft({ userId: '', delta: '', reason: '' })} className="flex-1 rounded-md border border-slate-200 px-4 py-3 font-black text-slate-600">Cancel</button>
                <button type="submit" disabled={actionId === `tokens-${tokenDraft.userId}`} className="flex-1 rounded-md bg-[#0284c7] px-4 py-3 font-black text-white disabled:opacity-60">Apply</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardBoundary>
  );
};

export default SuperAdminDashboard;
