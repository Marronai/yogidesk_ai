import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Eye, KeyRound, MoreVertical, RefreshCcw, Search, Shield, UserPlus, Users, Wallet } from 'lucide-react';
import api from '../../utils/api';
import { supabase } from '../../config/supabaseClient';

const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
const dateLabel = (value) => value ? new Date(value).toLocaleString() : 'No activity';
const PERMISSION_OPTIONS = [
  {
    key: 'can_view_owner_overview',
    label: 'View Owner Overview',
    detail: 'Full Financial Analytics Dashboard access',
  },
  {
    key: 'can_view_universal_matrix',
    label: 'Universal User Management Matrix',
    detail: 'View/Audit Doctors data',
  },
  {
    key: 'can_override_plan_wallet',
    label: 'Plan & Wallet Override Matrix',
    detail: 'Modify pricing/add credits',
  },
  {
    key: 'can_manage_meta_compliance',
    label: 'Meta Compliance Health Suite',
    detail: 'Template rejection controls',
  },
  {
    key: 'can_use_kill_switch',
    label: 'Direct Kill-Switch Access',
    detail: 'Suspend/Block Doctor Workspaces',
  },
];
const emptyPermissions = PERMISSION_OPTIONS.reduce((acc, item) => ({ ...acc, [item.key]: false }), {});

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState('');
  const [walletDraft, setWalletDraft] = useState({ userId: '', amount: '', reason: '' });
  const [superadminContext, setSuperadminContext] = useState({ isOwner: false, permissions: emptyPermissions });
  const [internalStaff, setInternalStaff] = useState([]);
  const [staffDraft, setStaffDraft] = useState({ name: '', email: '', permissions: emptyPermissions });
  const [staffMessage, setStaffMessage] = useState('');
  const [ghostDraft, setGhostDraft] = useState({ user: null, masterKey: '', error: '' });
  const [opsMonitor, setOpsMonitor] = useState({ templateAlert: null, analytics: null, webhookFailures: null });

  const loadDashboard = async (searchTerm = debouncedSearch) => {
    setLoading(true);
    try {
      const { data: meData } = await api.get('/superadmin/me');
      const permissions = meData?.permissions || emptyPermissions;
      const isOwner = Boolean(meData?.isOwner);
      setSuperadminContext({ isOwner, permissions });

      const [overviewResponse, usersResponse, staffResponse, templateAlertsResponse, analyticsResponse, webhookFailuresResponse] = await Promise.all([
        permissions.can_view_owner_overview ? api.get('/superadmin/overview') : Promise.resolve({ data: { data: null } }),
        permissions.can_view_universal_matrix ? api.get('/superadmin/users', { params: { search: searchTerm } }) : Promise.resolve({ data: { data: [] } }),
        isOwner ? api.get('/superadmin/staff/list') : Promise.resolve({ data: { data: [] } }),
        api.get('/superadmin/template-sync-alerts').catch(() => ({ data: { alert: null } })),
        api.get('/superadmin/central-analytics-monitor').catch(() => ({ data: { data: null } })),
        api.get('/superadmin/webhook-failures').catch(() => ({ data: { counters: null } })),
      ]);
      setOverview(overviewResponse.data?.data || null);
      setUsers(usersResponse.data?.data || []);
      setInternalStaff(staffResponse.data?.data || []);
      setOpsMonitor({
        templateAlert: templateAlertsResponse.data?.alert || null,
        analytics: analyticsResponse.data?.data || null,
        webhookFailures: webhookFailuresResponse.data?.counters || null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      try {
        if (!superadminContext.permissions.can_view_universal_matrix) {
          if (active) setUsers([]);
          return;
        }
        const { data } = await api.get('/superadmin/users', { params: { search: debouncedSearch } });
        if (active) setUsers(data?.data || []);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUsers();
    return () => { active = false; };
  }, [debouncedSearch, superadminContext.permissions.can_view_universal_matrix]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.legalName, user.clinicName, user.email, user.mobile]
      .some((value) => String(value || '').toLowerCase().includes(term)));
  }, [search, users]);
  const permissions = superadminContext.permissions || emptyPermissions;
  const canViewOverview = Boolean(permissions.can_view_owner_overview);
  const canViewMatrix = Boolean(permissions.can_view_universal_matrix);
  const canAdjustWallet = Boolean(permissions.can_override_plan_wallet);
  const canViewMetaHealth = Boolean(permissions.can_manage_meta_compliance);
  const canUseKillSwitch = Boolean(permissions.can_use_kill_switch);

  const toggleStatus = async (user) => {
    if (!canUseKillSwitch) return;
    setActionId(user.id);
    try {
      const nextBlocked = !user.isBlocked;
      const { data } = await api.patch(`/superadmin/users/${user.id}/status`, { isBlocked: nextBlocked });
      const nextStatus = data?.data?.systemStatus || (nextBlocked ? 'SUSPENDED' : 'ACTIVE');
      setUsers((current) => current.map((item) => item.id === user.id ? {
        ...item,
        isBlocked: nextBlocked,
        systemStatus: nextStatus,
      } : item));
    } finally {
      setActionId('');
    }
  };

  const impersonateUser = async (user) => {
    setActionId(user.id);
    try {
      const { data } = await api.post(`/superadmin/users/${user.id}/impersonate`);
      const shadow = data?.data;
      if (!shadow?.token || !shadow?.userId) throw new Error('Shadow session was not issued.');

      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      sessionStorage.setItem('yogidesk_superadmin_shadow', JSON.stringify(shadow));
      sessionStorage.setItem('token', shadow.token);
      sessionStorage.setItem('user_id', shadow.userId);
      sessionStorage.setItem('clinic_id', shadow.clinicId || '');
      sessionStorage.setItem('clinic_name', shadow.clinicName || 'Clinic Workspace');
      sessionStorage.setItem('user_role', 'doctor');
      localStorage.setItem('token', shadow.token);
      localStorage.setItem('user_id', shadow.userId);
      localStorage.setItem('clinic_name', shadow.clinicName || 'Clinic Workspace');
      localStorage.setItem('user_role', 'doctor');
      window.location.assign('/dashboard');
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
      sessionStorage.setItem('user_email', data.user.email || ghostDraft.user.email);
      sessionStorage.setItem('clinic_id', data.clinic?.id || '');
      sessionStorage.setItem('clinic_name', data.clinic?.name || ghostDraft.user.clinicName || 'Clinic Workspace');
      sessionStorage.setItem('user_role', 'doctor');
      localStorage.setItem('token', token);
      localStorage.setItem('user_id', data.user.id);
      localStorage.setItem('clinic_name', data.clinic?.name || ghostDraft.user.clinicName || 'Clinic Workspace');
      localStorage.setItem('user_role', 'doctor');
      window.location.assign('/dashboard');
    } catch (error) {
      setGhostDraft((current) => ({
        ...current,
        error: error.response?.data?.message || error.message || 'Unable to complete Ghost Login.',
      }));
    } finally {
      setActionId('');
    }
  };

  const adjustWallet = async (event) => {
    event.preventDefault();
    if (!walletDraft.userId || !canAdjustWallet) return;
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

  const inviteInternalStaff = async (event) => {
    event.preventDefault();
    setActionId('superadmin-staff-invite');
    setStaffMessage('');
    try {
      const { data } = await api.post('/superadmin/staff/invite', staffDraft);
      setInternalStaff((current) => [data?.data, ...current.filter((item) => item?.email !== data?.data?.email)].filter(Boolean));
      setStaffDraft({ name: '', email: '', permissions: emptyPermissions });
      setStaffMessage(data?.message || 'Internal staff permissions saved.');
    } catch (error) {
      setStaffMessage(error.response?.data?.message || 'Unable to save internal staff permissions.');
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
            onClick={() => loadDashboard()}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-100"
          >
            <RefreshCcw size={17} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
        {opsMonitor.templateAlert && (
          <section className="rounded-md border border-red-300 bg-red-600 px-5 py-4 text-white shadow-lg shadow-red-900/20">
            <p className="text-xs font-black uppercase tracking-widest text-red-100">Meta Template Sync Alert</p>
            <h2 className="mt-1 text-xl font-black">{opsMonitor.templateAlert.message}</h2>
            <p className="mt-1 text-sm font-semibold text-red-100">
              Latest rejected template: {opsMonitor.templateAlert.latest?.template_name || 'Unknown template'}
            </p>
          </section>
        )}

        {canViewOverview && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricPanel icon={Users} label="Total Registrations" value={overview?.totalRegistrations || 0} detail="Supabase Auth users excluding superadmin metadata." />
            <MetricPanel icon={Shield} label="Active Subscriptions" value={overview?.activeSubscriptions?.paid || 0} detail={`${overview?.activeSubscriptions?.trial || 0} free trial workspaces tracked.`} />
            <MetricPanel icon={Activity} label="Live Active Users" value={overview?.liveActiveUsers || 0} detail="Recent activity/session approximation from server activity streams." />
            {canViewMetaHealth && (
              <MetricPanel icon={AlertTriangle} label="Meta Compliance Health" value={overview?.metaComplianceHealth?.warningFlags || 0} detail="Aggregated template warning, failed, paused, or rejected flags." />
            )}
          </section>
        )}

        {opsMonitor.analytics && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Utility Messages This Month</p>
              <p className="mt-3 text-3xl font-black text-slate-950">{Number(opsMonitor.analytics.utilityMessages || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Marketing Messages This Month</p>
              <p className="mt-3 text-3xl font-black text-orange-600">{Number(opsMonitor.analytics.marketingMessages || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Webhook Failures</p>
              <p className="mt-3 text-3xl font-black text-red-600">{Number(opsMonitor.webhookFailures?.total || 0).toLocaleString()}</p>
              <p className="mt-2 text-xs font-bold text-slate-500">Server heap: {opsMonitor.analytics.serverLoad?.heapUsedMb || 0} MB</p>
            </div>
          </section>
        )}

        {superadminContext.isOwner && (
          <section className="rounded-md border border-white/20 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/20">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-400">Internal Control Staff</p>
                <h2 className="mt-2 text-2xl font-black">Unlimited Staff Invitation & Permission Matrix</h2>
              </div>
              <div className="rounded-md border border-white/15 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-300">
                {internalStaff.length} mapped operators
              </div>
            </div>

            <form onSubmit={inviteInternalStaff} className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Staff Name</span>
                  <input
                    value={staffDraft.name}
                    onChange={(event) => setStaffDraft((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 w-full rounded-md border border-white/15 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-orange-500"
                    placeholder="Staff Name"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Staff Email</span>
                  <input
                    type="email"
                    value={staffDraft.email}
                    onChange={(event) => setStaffDraft((current) => ({ ...current, email: event.target.value }))}
                    className="mt-2 w-full rounded-md border border-white/15 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-orange-500"
                    placeholder="staff@email.com"
                    required
                  />
                </label>
                <button
                  type="submit"
                  disabled={actionId === 'superadmin-staff-invite'}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#FF6A00] px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  <UserPlus size={18} />
                  Invite Staff
                </button>
                {staffMessage && <p className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-orange-200">{staffMessage}</p>}
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {PERMISSION_OPTIONS.map((option) => (
                  <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-md border border-white/15 bg-black/60 p-4 transition hover:border-orange-500">
                    <input
                      type="checkbox"
                      checked={Boolean(staffDraft.permissions[option.key])}
                      onChange={(event) => setStaffDraft((current) => ({
                        ...current,
                        permissions: { ...current.permissions, [option.key]: event.target.checked },
                      }))}
                      className="mt-1 h-4 w-4 accent-orange-500"
                    />
                    <span>
                      <span className="block text-sm font-black text-white">{option.label}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400">{option.detail}</span>
                    </span>
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
                      </div>
                      <span className="rounded-md bg-orange-500/15 px-2 py-1 text-[11px] font-black uppercase text-orange-300">{member.status || 'INVITED'}</span>
                    </div>
                    <div className="mt-3 space-y-1">
                      {PERMISSION_OPTIONS.filter((option) => member[option.key]).map((option) => (
                        <p key={option.key} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                          <CheckCircle2 size={13} className="text-orange-400" />
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

        {canViewMatrix && (
        <>
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
                  <th className="px-4 py-3">AI Messages</th>
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
                    <td className="px-4 py-4 font-black text-emerald-600">{user.walletBalanceLabel || money(user.walletBalance)}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold">Appointments: {user.appointments.total} | Pending: {user.appointments.pending} | Completed: {user.appointments.completed}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">Patients: {user.totalPatients}</p>
                      <p className="text-xs font-semibold text-slate-500">Team: {user.teamCount}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-blue-600">{Number(user.aiMessagesProcessed ?? user.geminiTokens ?? 0).toLocaleString()}</p>
                      <p className="text-xs font-semibold text-slate-500">Tokens: {Number(user.geminiTokens || 0).toLocaleString()}</p>
                    </td>
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
                        {canUseKillSwitch && (
                          <button
                            type="button"
                            disabled={actionId === user.id}
                            onClick={() => toggleStatus(user)}
                            className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-black uppercase text-white ${user.isBlocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'} disabled:opacity-60`}
                          >
                            <MoreVertical size={14} />
                            {user.isBlocked ? 'Reactivate' : 'Kill Switch'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={actionId === user.id}
                          onClick={() => impersonateUser(user)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-900 bg-slate-950 px-3 py-2 text-xs font-black uppercase text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          <Eye size={14} />
                          View Dashboard
                        </button>
                        <button
                          type="button"
                          disabled={actionId === `ghost-${user.id}`}
                          onClick={() => setGhostDraft({ user, masterKey: '', error: '' })}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-orange-700 bg-orange-700 px-3 py-2 text-xs font-black uppercase text-white hover:bg-orange-800 disabled:opacity-60"
                        >
                          <KeyRound size={14} />
                          Ghost Login
                        </button>
                        {canAdjustWallet && (
                          <button
                            type="button"
                            onClick={() => setWalletDraft({ userId: user.id, amount: '', reason: 'Superadmin manual wallet adjustment' })}
                            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-black uppercase text-slate-700 hover:bg-slate-50"
                          >
                            <Wallet size={14} />
                            Adjust Wallet
                          </button>
                        )}
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
        </>
        )}

        {!canViewOverview && !canViewMatrix && !superadminContext.isOwner && (
          <section className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-orange-600">Restricted Workspace</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">No Super Admin modules are enabled.</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Ask the owner Super Admin to assign at least one permission flag to this internal staff account.</p>
          </section>
        )}
      </main>

      {ghostDraft.user && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-6">
          <form onSubmit={submitGhostLogin} className="w-full max-w-md rounded-t-md border border-orange-500/30 bg-slate-950 p-5 text-white shadow-2xl shadow-black/40 sm:rounded-md">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-orange-600 text-white">
                <KeyRound size={21} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-300">Master Key Required</p>
                <h3 className="mt-1 text-xl font-black">Ghost Login</h3>
                <p className="mt-2 text-sm font-semibold text-slate-400">{ghostDraft.user.legalName} · {ghostDraft.user.email}</p>
              </div>
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Admin Master Key</span>
              <input
                type="password"
                value={ghostDraft.masterKey}
                onChange={(event) => setGhostDraft((current) => ({ ...current, masterKey: event.target.value, error: '' }))}
                className="mt-2 w-full rounded-md border border-white/15 bg-black px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-orange-500"
                autoComplete="off"
                required
              />
            </label>
            {ghostDraft.error && (
              <p className="mt-3 rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm font-bold text-orange-200">
                {ghostDraft.error}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setGhostDraft({ user: null, masterKey: '', error: '' })} className="flex-1 rounded-md border border-white/15 px-4 py-3 font-black text-slate-300">
                Cancel
              </button>
              <button type="submit" disabled={actionId === `ghost-${ghostDraft.user.id}`} className="flex-1 rounded-md bg-[#FF6A00] px-4 py-3 font-black text-white disabled:opacity-60">
                Enter
              </button>
            </div>
          </form>
        </div>
      )}

      {walletDraft.userId && canAdjustWallet && (
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
