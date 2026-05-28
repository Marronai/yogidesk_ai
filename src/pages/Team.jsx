import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, KeyRound, Mail, RefreshCw, Trash2, UserPlus, Users, X } from 'lucide-react';
import { supabase } from '../config/supabaseClient';
import { useWallet } from '../context/WalletContext';
import { API_URL } from '../utils/api';

const seatCaps = { starter: 1, growth: 2, hospital: 5 };
const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_EXPIRY_DAYS = 3;
const TEAM_CHANGE_COOLDOWN_DAYS = 30;

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);
const isPendingExpired = (member) => (
  String(member?.status || '').toUpperCase() === 'PENDING'
  && member?.invite_expires_at
  && new Date(member.invite_expires_at).getTime() <= Date.now()
);

const Team = () => {
  const { wallet, userId } = useWallet(); // Get wallet and userId from global context
  const [members, setMembers] = useState([]);  
  const [form, setForm] = useState({ name: '', email: '' });
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [inviteDraft, setInviteDraft] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const plan = (wallet.current_plan || wallet.plan_tier || 'starter').toLowerCase();
  const maxSeats = seatCaps[plan] || seatCaps.starter;
  const visibleMembers = useMemo(() => (
    members.filter((member) => !['DELETED', 'EXPIRED'].includes(String(member.status || '').toUpperCase()) && !isPendingExpired(member))
  ), [members]);
  const deletedOrRecentMembers = useMemo(() => (
    members.filter((member) => member.deleted_at || member.created_at)
  ), [members]);
  const latestTeamChangeAt = useMemo(() => {
    const timestamps = deletedOrRecentMembers
      .flatMap((member) => [member.deleted_at, member.created_at])
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);
    return timestamps.length ? new Date(Math.max(...timestamps)) : null;
  }, [deletedOrRecentMembers]);
  const nextInviteAllowedAt = latestTeamChangeAt ? addDays(latestTeamChangeAt, TEAM_CHANGE_COOLDOWN_DAYS) : null;
  const isInviteCoolingDown = Boolean(nextInviteAllowedAt && nextInviteAllowedAt.getTime() > Date.now());
  const isFull = visibleMembers.length >= maxSeats;
  const inviteDisabled = isFull || isInviteCoolingDown;

  const seatLabel = useMemo(() => `${visibleMembers.length} / ${maxSeats} staff seats used`, [visibleMembers.length, maxSeats]);
  const cooldownLabel = nextInviteAllowedAt
    ? nextInviteAllowedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user || { id: localStorage.getItem('user_id') };
  };

  const fetchTeam = async () => {    
    setLoading(true);
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data: teamData } = await supabase
      .from('team_members')
      .select('id, name, email, status, created_at, invite_expires_at, deleted_at')
      .eq('admin_id', userId)
      .order('created_at', { ascending: false });

    const normalizedTeam = (teamData || []).map((member) => (
      isPendingExpired(member) ? { ...member, status: 'EXPIRED' } : member
    ));
    const expiredIds = normalizedTeam
      .filter((member) => member.status === 'EXPIRED' && member.id)
      .map((member) => member.id);

    if (expiredIds.length) {
      await supabase.from('team_members').update({ status: 'EXPIRED' }).in('id', expiredIds);
    }

    setMembers(normalizedTeam);
    setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, [userId]);

  const dispatchTeamInviteEmail = (invite) => {
    const payload = JSON.stringify(invite);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_URL}/api/team/dispatch-invite-email`, new Blob([payload], { type: 'application/json' }));
      return;
    }

    fetch(`${API_URL}/api/team/dispatch-invite-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  };

  const saveVerifiedInvite = async ({ user, nameInput, emailInput }) => {
    const { data, error } = await supabase
      .from('team_members')
      .insert([{
        admin_id: user.id,
        name: nameInput,
        email: emailInput,
        status: 'PENDING',
        invite_expires_at: addDays(new Date(), INVITE_EXPIRY_DAYS).toISOString()
      }])
      .select('id, name, email, status, created_at, invite_expires_at, deleted_at')
      .single();

    if (error) {
      setAlert(error.message || 'Invite failed.');
      return;
    }

    setMembers((prev) => [data, ...prev]);
    const inviteLink = `${window.location.origin}/accept-invite?email=${encodeURIComponent(emailInput)}`;
    dispatchTeamInviteEmail({
      email: emailInput,
      name: nameInput,
      inviteLink,
      adminId: user.id,
    });
    console.log(`Yogi Desk invite setup link: ${inviteLink}`);
    setAlert(`Invite saved and email dispatch triggered for ${emailInput}.`);
    setForm({ name: '', email: '' });
    setGateOpen(false);
    setInviteDraft(null);
    setAdminOtp('');
  };

  const handleInvite = async (event) => {
    event.preventDefault();
    setAlert('');

    if (isFull) {
      setAlert(`Your ${plan} plan allows ${maxSeats} team seat${maxSeats > 1 ? 's' : ''}. Upgrade to add more staff.`);
      return;
    }
    if (isInviteCoolingDown) {
      setAlert(`Team changes are limited to one new staff invite every ${TEAM_CHANGE_COOLDOWN_DAYS} days. You can add the next user after ${cooldownLabel}.`);
      return;
    }

    const nameInput = form.name.trim();
    const emailInput = form.email.trim().toLowerCase();
    if (!nameInput || !emailInput) {
      setAlert('Name and email are required.');
      return;
    }

    const user = await getUser();
    if (!user?.id) {
      setAlert('Login session missing. Please sign in again.');
      return;
    }

    setInviteDraft({ user, nameInput, emailInput });
    setAdminEmail(user?.email || localStorage.getItem('user_email') || '');
    setAdminOtp('');
    setGateOpen(true);
  };

  const confirmDeleteMember = async () => {
    if (!deleteTarget?.id) return;

    try {
      setDeleting(true);
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('team_members')
        .update({ status: 'DELETED', deleted_at: now })
        .eq('id', deleteTarget.id)
        .eq('admin_id', userId);

      if (error) throw error;

      setMembers((current) => current.map((member) => (
        member.id === deleteTarget.id ? { ...member, status: 'DELETED', deleted_at: now } : member
      )));
      setAlert(`Team member deleted. You can add the next user after ${addDays(new Date(), TEAM_CHANGE_COOLDOWN_DAYS).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}.`);
      setDeleteTarget(null);
    } catch (error) {
      setAlert(error.message || 'Unable to delete this team member.');
    } finally {
      setDeleting(false);
    }
  };

  const sendAdminOtp = async () => {
    try {
      setGateLoading(true);
      const response = await fetch(`${API_URL}/api/auth/request-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim().toLowerCase(),
          name: inviteDraft?.user?.user_metadata?.full_name || localStorage.getItem('user_name') || 'Admin',
          purpose: 'team-invite',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.msg || 'Unable to send admin OTP.');
      setAlert('Admin OTP sent to email. Enter the code to unlock the invite.');
    } catch (error) {
      setAlert(error.message || 'Unable to send email OTP.');
    } finally {
      setGateLoading(false);
    }
  };

  const verifyAndSaveInvite = async () => {
    if (!inviteDraft) return;
    if (!adminEmail.trim() || adminOtp.trim().length !== 6) {
      setAlert('Please send and enter the 6-digit admin OTP.');
      return;
    }

    try {
      setGateLoading(true);
      const response = await fetch(`${API_URL}/api/auth/verify-email-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim().toLowerCase(),
          otp: adminOtp.trim(),
          purpose: 'team-invite',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.msg || 'Admin email verification failed.');
      await saveVerifiedInvite(inviteDraft);
    } catch (error) {
      setAlert(error.message || 'Admin email verification failed.');
    } finally {
      setGateLoading(false);
    }
  };

  return (
    <div className="p-8 font-sans space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Admin Control</p>
          <h1 className="text-3xl font-black text-slate-900 mt-2">Team Setup</h1>
          <p className="text-slate-500 mt-1">Invite staff members and control shared inbox ownership.</p>
        </div>
        <div className={`rounded-2xl border px-5 py-4 ${isFull ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          <div className="flex items-center gap-2 text-sm font-black">
            <Users size={18} />
            {seatLabel}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider mt-1">{plan} plan</p>
        </div>
      </div>

      {alert && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          <AlertTriangle size={18} />
          {alert}
        </div>
      )}

      {gateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Verify Admin Email</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Complete OTP validation before sending this team invite.</p>
              </div>
              <button
                type="button"
                onClick={() => setGateOpen(false)}
                className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="Admin email"
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm font-semibold outline-none focus:border-orange-400"
                />
              </div>
              <button
                type="button"
                onClick={sendAdminOtp}
                disabled={gateLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-3 text-sm font-black text-orange-700 hover:bg-orange-100 disabled:opacity-60"
              >
                <Mail size={17} />
                Send Admin OTP
              </button>
              <input
                value={adminOtp}
                onChange={(e) => setAdminOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-center text-lg font-black tracking-[0.35em] outline-none focus:border-orange-400"
              />
              <button
                type="button"
                onClick={verifyAndSaveInvite}
                disabled={gateLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 hover:bg-orange-700 disabled:opacity-60"
              >
                <KeyRound size={18} />
                Verify & Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Delete Team Member</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  This will remove this staff member from your team. After deleting a user, you cannot add another new user for 30 days. Pending invites that are not accepted expire automatically after 3 days.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              Are you sure you want to delete {deleteTarget.name || deleteTarget.email}?
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMember}
                disabled={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-100 hover:bg-red-700 disabled:opacity-60"
              >
                <Trash2 size={17} />
                {deleting ? 'Deleting...' : 'Delete Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[380px_1fr] gap-6">
        <form onSubmit={handleInvite} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Invite Member</h2>
            <p className="text-sm text-slate-500 mt-1">Add staff access by name and email.</p>
          </div>

          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Staff name"
            disabled={inviteDisabled}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="staff@email.com"
            disabled={inviteDisabled}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={inviteDisabled}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            <UserPlus size={18} />
            Send Invite
          </button>
          {isInviteCoolingDown && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              <Clock className="mt-0.5 shrink-0" size={15} />
              One new staff user can be added every 30 days. Next invite available after {cooldownLabel}.
            </div>
          )}
        </form>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-black text-slate-900">Active Team</h2>
            <button onClick={fetchTeam} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {visibleMembers.length === 0 ? (
              <div className="p-10 text-center text-sm font-semibold text-slate-400">No staff invited yet.</div>
            ) : (
              visibleMembers.map((member) => (
                <div key={member.id || member.email} className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center font-black">
                      {(member.name || member.email || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 truncate">{member.name}</p>
                      <p className="flex items-center gap-1 text-xs text-slate-500 truncate"><Mail size={12} /> {member.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      {member.status || 'INVITED'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(member)}
                      className="rounded-xl p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-600"
                      title="Delete team member"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Team;
