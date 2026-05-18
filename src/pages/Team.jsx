import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Mail, RefreshCw, UserPlus, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

const seatCaps = { starter: 1, growth: 2, hospital: 5 };

const Team = () => {
  const [members, setMembers] = useState([]);
  const [wallet, setWallet] = useState({ current_plan: 'starter', plan_tier: 'starter' });
  const [form, setForm] = useState({ name: '', email: '' });
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);

  const plan = (wallet.current_plan || wallet.plan_tier || 'starter').toLowerCase();
  const maxSeats = seatCaps[plan] || seatCaps.starter;
  const isFull = members.length >= maxSeats;

  const seatLabel = useMemo(() => `${members.length} / ${maxSeats} staff seats used`, [members.length, maxSeats]);

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data?.user || { id: localStorage.getItem('user_id') };
  };

  const fetchTeam = async () => {
    setLoading(true);
    const user = await getUser();
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const [{ data: walletData }, { data: teamData }] = await Promise.all([
      supabase.from('wallets').select('current_plan, plan_tier').eq('user_id', user.id).single(),
      supabase.from('team_members').select('id, name, email, status, created_at').order('created_at', { ascending: false }),
    ]);

    if (walletData) setWallet(walletData);
    if (teamData) setMembers(teamData);
    setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, []);

  const handleInvite = async (event) => {
    event.preventDefault();
    setAlert('');

    if (isFull) {
      setAlert(`Your ${plan} plan allows ${maxSeats} team seat${maxSeats > 1 ? 's' : ''}. Upgrade to add more staff.`);
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

    const { data, error } = await supabase
      .from('team_members')
      .insert([{ admin_id: user.id, name: nameInput, email: emailInput, status: 'PENDING' }])
      .select('id, name, email, status, created_at')
      .single();

    if (error) {
      setAlert(error.message || 'Invite failed.');
      return;
    }

    setMembers((prev) => [data, ...prev]);
    const inviteLink = `http://localhost:5173/accept-invite?email=${emailInput}`;
    console.log(`Yogi Desk invite setup link: ${inviteLink}`);
    setAlert(`Invite saved. Local setup link: ${inviteLink}`);
    setForm({ name: '', email: '' });
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
            disabled={isFull}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="staff@email.com"
            disabled={isFull}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-orange-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={isFull}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-100 hover:bg-orange-700 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
          >
            <UserPlus size={18} />
            Send Invite
          </button>
        </form>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-black text-slate-900">Active Team</h2>
            <button onClick={fetchTeam} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {members.length === 0 ? (
              <div className="p-10 text-center text-sm font-semibold text-slate-400">No staff invited yet.</div>
            ) : (
              members.map((member) => (
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
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    {member.status || 'INVITED'}
                  </span>
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
