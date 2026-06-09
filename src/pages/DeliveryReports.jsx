import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, CalendarDays, CheckCircle2, Download, Eye, Loader2, Send, X, XCircle } from 'lucide-react';
import { supabase } from '../config/supabaseClient';

const FILTER_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'past7', label: 'Past 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

const STATUS_STYLES = {
  sent: 'bg-orange-50 text-orange-700 ring-orange-100',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  read: 'bg-blue-50 text-blue-700 ring-blue-100',
  failed: 'bg-red-50 text-red-700 ring-red-100',
};

const STATUS_LABELS = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

const sanitizeCell = (value, maxLength = 160) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/[<>`]/g, '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/(--|\/\*|\*\/|;|\b(ALTER|CREATE|DELETE|DROP|EXEC|INSERT|MERGE|SELECT|TRUNCATE|UNION|UPDATE)\b)/gi, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxLength);

const normalizeStatus = (value) => {
  const status = sanitizeCell(value, 24).toLowerCase();
  if (['sent', 'delivered', 'read', 'failed'].includes(status)) return status;
  return 'sent';
};

const normalizeMessageType = (value) => {
  const type = sanitizeCell(value, 32).toLowerCase();
  if (type.includes('session') || type === 'public' || type === 'text') return 'Session';
  if (type.includes('template')) return 'Template';
  return sanitizeCell(value, 32) || 'Template';
};

const maskPhone = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 4) return 'Hidden';
  const suffix = digits.slice(-4);
  const prefix = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
  return `${prefix}******${suffix}`;
};

const safeDate = (value) => {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date : null;
};

const formatDateTime = (value) => {
  const date = safeDate(value);
  if (!date) return 'Invalid date';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const resolveRange = (filter, customRange) => {
  const now = new Date();
  if (filter === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }
  if (filter === 'past7') {
    const from = startOfDay(new Date(now));
    from.setDate(from.getDate() - 6);
    return { from, to: endOfDay(now) };
  }
  if (filter === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  }
  if (filter === 'custom') {
    const from = safeDate(customRange.from);
    const to = safeDate(customRange.to);
    return {
      from: from ? startOfDay(from) : startOfDay(now),
      to: to ? endOfDay(to) : endOfDay(now),
    };
  }
  return { from: startOfDay(now), to: endOfDay(now) };
};

const csvEscape = (value) => {
  const text = sanitizeCell(value, 240);
  return `"${text.replace(/"/g, '""')}"`;
};

const DeliveryReports = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customRange, setCustomRange] = useState({
    from: toDateInputValue(new Date()),
    to: toDateInputValue(new Date()),
  });
  const [draftRange, setDraftRange] = useState(customRange);
  const [showCustomRangeModal, setShowCustomRangeModal] = useState(false);

  const activeRange = useMemo(() => resolveRange(dateFilter, customRange), [customRange, dateFilter]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData?.user?.id || localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || '';
      if (authError && !userId) throw authError;
      if (!userId) throw new Error('Unable to identify the current doctor workspace.');

      const { data, error: queryError } = await supabase
        .from('whatsapp_message_logs')
        .select('sent_at, recipient_phone, message_type, delivery_status')
        .eq('doctor_id', userId)
        .gte('sent_at', activeRange.from.toISOString())
        .lte('sent_at', activeRange.to.toISOString())
        .order('sent_at', { ascending: false })
        .limit(1000);

      if (queryError) throw queryError;

      const safeRows = (Array.isArray(data) ? data : []).map((row, index) => ({
        id: `${sanitizeCell(row.sent_at, 40)}-${index}`,
        sent_at: safeDate(row.sent_at)?.toISOString() || '',
        recipient_phone: sanitizeCell(row.recipient_phone, 40),
        message_type: normalizeMessageType(row.message_type),
        delivery_status: normalizeStatus(row.delivery_status),
      }));

      setLogs(safeRows);
    } catch {
      setError('Unable to load delivery reports right now.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [activeRange]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const metrics = useMemo(() => {
    const total = logs.length;
    const delivered = logs.filter((row) => ['delivered', 'read'].includes(row.delivery_status)).length;
    const read = logs.filter((row) => row.delivery_status === 'read').length;
    const failed = logs.filter((row) => row.delivery_status === 'failed').length;
    return { total, delivered, read, failed };
  }, [logs]);

  const exportCsv = () => {
    if (exporting || logs.length === 0) return;
    setExporting(true);

    window.setTimeout(() => {
      const header = ['Patient Number', 'Date & Time', 'Message Type', 'Status'];
      const rows = logs.map((row, index) => [
        index + 1,
        maskPhone(row.recipient_phone),
        formatDateTime(row.sent_at),
        row.message_type,
        STATUS_LABELS[row.delivery_status] || 'Sent',
      ]);
      const csv = [['S.No.', ...header], ...rows]
        .map((row) => row.map(csvEscape).join(','))
        .join('\n');
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const dateStamp = toDateInputValue(new Date());
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `YogiDesk_Delivery_Report_${dateStamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 0);
  };

  const handleDateFilterChange = (value) => {
    setDateFilter(value);
    if (value === 'custom') {
      setDraftRange(customRange);
      setShowCustomRangeModal(true);
    }
  };

  const applyCustomRange = () => {
    setCustomRange({
      from: sanitizeCell(draftRange.from, 10),
      to: sanitizeCell(draftRange.to, 10),
    });
    setDateFilter('custom');
    setShowCustomRangeModal(false);
  };

  const metricCards = [
    {
      label: 'Total Sent',
      sublabel: 'कुल भेजे गए',
      value: metrics.total,
      icon: Send,
      card: 'border-slate-100 bg-white text-slate-900',
      iconBox: 'bg-slate-100 text-slate-700 ring-slate-200',
      valueClass: 'text-slate-950',
      labelClass: 'text-slate-500',
      sublabelClass: 'text-slate-600',
    },
    {
      label: 'Successfully Delivered',
      sublabel: 'मैसेज मिला',
      value: metrics.delivered,
      icon: CheckCircle2,
      card: 'border-emerald-100 bg-white text-slate-900',
      iconBox: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      valueClass: 'text-emerald-600',
      labelClass: 'text-slate-500',
      sublabelClass: 'text-emerald-700',
    },
    {
      label: 'Opened / Read',
      sublabel: 'मैसेज पढ़ा',
      value: metrics.read,
      icon: Eye,
      card: 'border-blue-100 bg-white text-slate-900',
      iconBox: 'bg-blue-600 text-white ring-blue-100',
      valueClass: 'text-blue-600',
      labelClass: 'text-slate-500',
      sublabelClass: 'text-blue-700',
    },
    {
      label: 'Failed',
      sublabel: 'नहीं गया',
      value: metrics.failed,
      icon: XCircle,
      card: 'border-red-200 bg-white text-slate-900',
      iconBox: 'bg-red-50 text-red-600 ring-red-100',
      valueClass: 'text-red-600',
      labelClass: 'text-slate-500',
      sublabelClass: 'text-red-700',
    },
  ];

  return (
    <div className="min-h-screen bg-blue-50/40 px-4 py-6 sm:px-6 lg:px-8">
      {showCustomRangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl shadow-slate-200/70">
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF6B00]">Custom Range</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">Select report dates</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomRangeModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 active:scale-95"
                aria-label="Close custom date range"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">From</span>
                <input
                  type="date"
                  value={draftRange.from}
                  onChange={(event) => setDraftRange((current) => ({ ...current, from: sanitizeCell(event.target.value, 10) }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">To</span>
                <input
                  type="date"
                  value={draftRange.to}
                  onChange={(event) => setDraftRange((current) => ({ ...current, to: sanitizeCell(event.target.value, 10) }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCustomRangeModal(false)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={applyCustomRange}
                className="rounded-2xl bg-[#FF6B00] px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-95"
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm shadow-slate-200/60">
          <div className="flex flex-col gap-5 bg-white px-6 py-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#FF6B00] ring-1 ring-orange-100">
                <BarChart3 size={26} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#FF6B00]">Message Analytics</p>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Delivery Reports</h1>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
                  Simple WhatsApp delivery status for your clinic workspace.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              {formatDateTime(activeRange.from)} - {formatDateTime(activeRange.to)}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map(({ label, sublabel, value, icon: Icon, card, iconBox, valueClass, labelClass, sublabelClass }) => (
            <div key={label} className={`rounded-3xl border p-5 shadow-sm ${card}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-black uppercase tracking-widest ${labelClass}`}>{label}</p>
                  <p className={`mt-1 text-sm font-bold ${sublabelClass}`}>{sublabel}</p>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${iconBox}`}>
                  <Icon size={22} />
                </div>
              </div>
              <p className={`mt-5 text-4xl font-black ${valueClass}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Date Filter</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Choose reporting window</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-[260px_auto] sm:items-end">
              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Range</span>
                <select
                  value={dateFilter}
                  onChange={(event) => handleDateFilterChange(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:border-[#FF6B00] focus:ring-4 focus:ring-orange-100"
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {dateFilter === 'custom' && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftRange(customRange);
                    setShowCustomRangeModal(true);
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-[#FF6B00] active:scale-95"
                >
                  Edit Calendar Range
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm shadow-slate-200/50">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Delivery Log</p>
              <p className="mt-1 text-sm font-bold text-slate-600">{logs.length} records in current filter</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting || logs.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF6B00] px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                📥 Export Report to Excel/CSV
              </button>
              <CalendarDays className="hidden text-[#FF6B00] sm:block" size={22} />
            </div>
          </div>

          {error && (
            <div className="m-5 flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {['Patient Number', 'Despatch Date & Time', 'Context Type', 'Delivery Status'].map((heading) => (
                    <th key={heading} className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm font-bold text-slate-400">
                      <Loader2 className="mx-auto mb-3 animate-spin text-[#FF6B00]" size={24} />
                      Loading delivery reports...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm font-bold text-slate-400">
                      No delivery records found for this date range.
                    </td>
                  </tr>
                ) : logs.map((row) => (
                  <tr key={row.id} className="transition hover:bg-blue-50/40">
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-black text-slate-800">{maskPhone(row.recipient_phone)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-600">{formatDateTime(row.sent_at)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-bold text-slate-700">{row.message_type}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-widest ring-1 ${STATUS_STYLES[row.delivery_status] || STATUS_STYLES.sent}`}>
                        {STATUS_LABELS[row.delivery_status] || 'Sent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DeliveryReports;
