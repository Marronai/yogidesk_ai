import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CheckCircle2, Clock3, Loader2, Lock, Plus, Save, Settings, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';

const emptyAppointmentForm = {
  patient_name: '',
  patient_phone: '',
  appointment_at: '',
};

const emptySettings = {
  reminder_timing: '1_hour',
  reminder_text: 'Namaste {{PATIENT_NAME}}, aapka appointment {{APPOINTMENT_TIME}} par scheduled hai.',
  review_timing: 'same_day_7pm',
  review_text: 'Aapka checkup kaisa raha? 🙏 Review dijiye: {{GOOGLE_REVIEW_LINK}}',
};

const reminderOptions = [
  { value: '30_minutes', label: '30 Minutes Before' },
  { value: '1_hour', label: '1 Hour Before' },
  { value: '2_hours', label: '2 Hours Before' },
  { value: '24_hours', label: '24 Hours Before' },
];

const reviewOptions = [
  { value: '2_hours_after_complete', label: '2 Hours After Status Complete' },
  { value: 'same_day_7pm', label: 'Same day evening at 7 PM' },
];

const templateTokens = ['{{PATIENT_NAME}}', '{{APPOINTMENT_TIME}}'];
const reviewTokens = ['{{PATIENT_NAME}}', '{{GOOGLE_REVIEW_LINK}}'];

const sanitizeUnicodeText = (value, maxLength = 1200) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/[<>`]/g, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\$\{/g, '{')
  .replace(/\s+/g, ' ')
  .trimStart()
  .slice(0, maxLength);

const sanitizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 10);

const safeDateTime = (value) => {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date : null;
};

const formatAppointmentDateTime = (value) => {
  const date = safeDateTime(value);
  if (!date) {
    const fallback = sanitizeUnicodeText(String(value || '').replace('T', ' '), 80);
    return fallback || '-';
  }
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getSettingsKey = (workspaceId) => `yogidesk_appointment_settings_${String(workspaceId || 'default').replace(/[^\w-]/g, '') || 'default'}`;

const readLocalSettings = (workspaceId) => {
  try {
    return { ...emptySettings, ...(JSON.parse(localStorage.getItem(getSettingsKey(workspaceId)) || 'null') || {}) };
  } catch {
    return emptySettings;
  }
};

const Appointments = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [planTier, setPlanTier] = useState('growth');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [form, setForm] = useState(emptyAppointmentForm);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appointmentSettings, setAppointmentSettings] = useState(emptySettings);
  const [error, setError] = useState('');
  const reminderRef = useRef(null);
  const reviewRef = useRef(null);

  const isLocked = String(planTier || '').toLowerCase() === 'basic';

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const activeUserId = authData?.user?.id || localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || '';
      if (authError && !activeUserId) throw authError;
      if (!activeUserId) throw new Error('Missing workspace.');
      setUserId(activeUserId);
      setAppointmentSettings(readLocalSettings(activeUserId));

      const { data: profile } = await supabase
        .from('doctor_profiles')
        .select('plan_tier,current_plan,subscription_tier,runtime_plan')
        .eq('id', activeUserId)
        .maybeSingle();
      const tier = profile?.runtime_plan || profile?.plan_tier || profile?.current_plan || profile?.subscription_tier || 'growth';
      setPlanTier(String(tier || 'growth').toLowerCase());

      const response = await api.get('/api/appointments', { params: { userId: activeUserId } });
      const data = Array.isArray(response.data?.appointments) ? response.data.appointments : [];
      setAppointments((Array.isArray(data) ? data : []).map((row) => ({
        id: row.id,
        patient_name: sanitizeUnicodeText(row.patient_name, 100),
        patient_phone: sanitizePhone(row.patient_phone),
        appointment_at: [row.appointment_date, row.appointment_time].filter(Boolean).join('T'),
        status: String(row.status || 'Pending').toLowerCase() === 'completed' ? 'Completed' : 'Pending',
      })));
    } catch {
      setError('Unable to load appointments right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const updateForm = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: field === 'patient_phone' ? sanitizePhone(value) : sanitizeUnicodeText(value, field === 'patient_name' ? 100 : 40),
    }));
  };

  const addAppointment = async () => {
    const patientName = sanitizeUnicodeText(form.patient_name, 100).trim();
    const patientPhone = sanitizePhone(form.patient_phone);
    const appointmentDate = safeDateTime(form.appointment_at);
    if (!patientName || patientPhone.length !== 10 || !appointmentDate || !userId) {
      setError('Add patient name, 10-digit phone, and appointment date-time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const row = {
        patient_name: patientName,
        patient_phone: patientPhone,
        appointment_date: appointmentDate.toISOString().slice(0, 10),
        appointment_time: appointmentDate.toTimeString().slice(0, 5),
        status: 'Pending',
        source: 'dashboard',
        metadata: { reminder_settings_active: true },
      };
      const response = await api.post('/api/appointments', { ...row, userId });
      const data = response.data?.appointment || {};
      setAppointments((current) => [{
        id: data?.id || `local-${Date.now()}`,
        patient_name: patientName,
        patient_phone: patientPhone,
        appointment_at: `${row.appointment_date}T${row.appointment_time}`,
        status: 'Pending',
      }, ...current]);
      setForm(emptyAppointmentForm);
    } catch {
      setError('Unable to save appointment.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (appointment) => {
    const nextStatus = appointment.status === 'Completed' ? 'Pending' : 'Completed';
    setAppointments((current) => current.map((item) => (item.id === appointment.id ? { ...item, status: nextStatus } : item)));
    try {
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: nextStatus })
        .eq('doctor_id', userId)
        .eq('id', appointment.id);
      if (updateError) throw updateError;
    } catch {
      setAppointments((current) => current.map((item) => (item.id === appointment.id ? appointment : item)));
      setError('Unable to update appointment status.');
    }
  };

  const insertToken = (target, token) => {
    const ref = target === 'review_text' ? reviewRef : reminderRef;
    const currentValue = appointmentSettings[target] || '';
    const start = ref.current?.selectionStart ?? currentValue.length;
    const end = ref.current?.selectionEnd ?? start;
    const nextValue = sanitizeUnicodeText(`${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`);
    setAppointmentSettings((current) => ({ ...current, [target]: nextValue }));
    window.requestAnimationFrame(() => {
      ref.current?.focus();
      const cursor = Math.min(start + token.length, nextValue.length);
      ref.current?.setSelectionRange(cursor, cursor);
    });
  };

  const saveSettings = () => {
    const safeSettings = {
      reminder_timing: reminderOptions.some((item) => item.value === appointmentSettings.reminder_timing) ? appointmentSettings.reminder_timing : '1_hour',
      reminder_text: sanitizeUnicodeText(appointmentSettings.reminder_text, 1200),
      review_timing: reviewOptions.some((item) => item.value === appointmentSettings.review_timing) ? appointmentSettings.review_timing : 'same_day_7pm',
      review_text: sanitizeUnicodeText(appointmentSettings.review_text, 1200),
    };
    localStorage.setItem(getSettingsKey(userId || 'default'), JSON.stringify(safeSettings));
    setAppointmentSettings(safeSettings);
    setSettingsOpen(false);
  };

  const stats = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter((item) => item.status !== 'Completed').length,
    completed: appointments.filter((item) => item.status === 'Completed').length,
  }), [appointments]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-[#FF6B00]" size={28} />
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm shadow-slate-200/60">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6B00]">
              <Lock size={30} />
            </div>
            <h1 className="mt-6 text-2xl font-black text-slate-950">Appointments Locked</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-500">
              Upgrade to Growth Plan to Unlock Automated Reminders and Google Review Collectors.
            </p>
            <button
              type="button"
              onClick={() => navigate('/dashboard/subscription')}
              className="mt-6 rounded-2xl bg-[#FF6B00] px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-95"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/60">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6B00] ring-1 ring-orange-100">
                <CalendarCheck size={25} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FF6B00]">Automated Care</p>
                <h1 className="mt-2 text-2xl font-black text-slate-950">Appointments</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">Manage reminders, visits, and review collectors from one clean ledger.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 active:scale-95"
            >
              <Settings size={18} />
              Appointment Settings
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Total Appointments', value: stats.total, icon: CalendarCheck },
            { label: 'Pending', value: stats.pending, icon: Clock3 },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6B00]">
                  <Icon size={20} />
                </div>
              </div>
              <p className="mt-4 text-4xl font-black text-slate-950">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="grid gap-3 lg:grid-cols-[1.1fr_180px_240px_auto]">
            <input
              value={form.patient_name}
              onChange={(event) => updateForm('patient_name', event.target.value)}
              placeholder="Patient Name"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
            />
            <input
              value={form.patient_phone}
              onChange={(event) => updateForm('patient_phone', event.target.value)}
              inputMode="numeric"
              placeholder="10-digit Phone"
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
            />
            <input
              type="datetime-local"
              value={form.appointment_at}
              onChange={(event) => updateForm('appointment_at', event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
            />
            <button
              type="button"
              onClick={addAppointment}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Add
            </button>
          </div>
          {error && <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">{error}</div>}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm shadow-slate-200/50">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Patient', 'Phone', 'Appointment', 'Status', 'Actions'].map((heading) => (
                    <th key={heading} className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm font-bold text-slate-400">No appointments added yet.</td>
                  </tr>
                ) : appointments.map((appointment) => (
                  <tr key={appointment.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4 text-sm font-black text-slate-950">{appointment.patient_name}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">{appointment.patient_phone}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-600">{formatAppointmentDateTime(appointment.appointment_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ring-1 ${
                        appointment.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-orange-50 text-orange-700 ring-orange-100'
                      }`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleStatus(appointment)}
                        className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 active:scale-95"
                      >
                        {appointment.status === 'Completed' ? 'Mark Pending' : 'Mark Completed'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FF6B00]">Automation</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Appointment Settings</h2>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Appointment Reminder Settings</h3>
                <label className="mt-4 block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reminder Timing</span>
                  <select
                    value={appointmentSettings.reminder_timing}
                    onChange={(event) => setAppointmentSettings((current) => ({ ...current, reminder_timing: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black outline-none focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                  >
                    {reminderOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  {templateTokens.map((token) => (
                    <button key={token} type="button" onClick={() => insertToken('reminder_text', token)} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-black text-slate-800">
                      {token}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={reminderRef}
                  value={appointmentSettings.reminder_text}
                  onChange={(event) => setAppointmentSettings((current) => ({ ...current, reminder_text: sanitizeUnicodeText(event.target.value, 1200) }))}
                  rows={6}
                  className="mt-3 w-full resize-none rounded-2xl border border-slate-200 px-4 py-4 text-sm font-semibold leading-6 outline-none placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                  placeholder="Namaste {{PATIENT_NAME}}, aapka appointment {{APPOINTMENT_TIME}} par scheduled hai."
                />
              </section>

              <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-slate-950">Review Collector Settings</h3>
                <label className="mt-4 block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Review Timing</span>
                  <select
                    value={appointmentSettings.review_timing}
                    onChange={(event) => setAppointmentSettings((current) => ({ ...current, review_timing: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black outline-none focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                  >
                    {reviewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  {reviewTokens.map((token) => (
                    <button key={token} type="button" onClick={() => insertToken('review_text', token)} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-[10px] font-black text-slate-800">
                      {token}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={reviewRef}
                  value={appointmentSettings.review_text}
                  onChange={(event) => setAppointmentSettings((current) => ({ ...current, review_text: sanitizeUnicodeText(event.target.value, 1200) }))}
                  rows={6}
                  className="mt-3 w-full resize-none rounded-2xl border border-slate-200 px-4 py-4 text-sm font-semibold leading-6 outline-none placeholder:text-slate-400 focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                  placeholder="Aapka checkup kaisa raha? 🙏 Review dijiye: {{GOOGLE_REVIEW_LINK}}"
                />
              </section>

              <button
                type="button"
                onClick={saveSettings}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-6 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-95"
              >
                <Save size={18} />
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
