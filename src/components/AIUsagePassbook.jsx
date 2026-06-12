import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, MessageSquare } from 'lucide-react';

const ROWS_PER_PAGE = 10;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDateTime = (value) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const getUsage = (row = {}) => {
  const metadata = row.metadata || {};
  const usage = metadata.usage || {};
  return {
    inputTokens: Number(usage.input_tokens ?? metadata.input_tokens ?? 0),
    outputTokens: Number(usage.output_tokens ?? metadata.output_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? metadata.total_tokens ?? 0),
    creditsDeducted: Math.abs(Number(row.credits_deducted ?? usage.credits_deducted ?? metadata.credits_deducted ?? row.messages_delta ?? 0)),
  };
};

const isWithinRange = (row, startDate, endDate) => {
  const rowTime = new Date(row.created_at).getTime();
  if (!Number.isFinite(rowTime)) return false;
  if (startDate) {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    if (Number.isFinite(start) && rowTime < start) return false;
  }
  if (endDate) {
    const end = new Date(`${endDate}T23:59:59`).getTime();
    if (Number.isFinite(end) && rowTime > end) return false;
  }
  return true;
};

const exportUsageStatementPdf = ({
  rows,
  startDate,
  endDate,
  clinicName,
  clinicPhoneNumber,
}) => {
  const rangeText = `${startDate || 'All dates'} to ${endDate || 'Present'}`;
  const phoneDigits = String(clinicPhoneNumber || '').replace(/\D/g, '');
  const displayDocId = `YOGI-DOC-${phoneDigits || 'REGISTERED'}`;
  const tableRows = rows.map((row) => {
    const usage = getUsage(row);
    const patient = row.patient_number || 'Patient';
    const tokenBreakdown = [
      `Input: ${usage.inputTokens.toLocaleString('en-IN')}`,
      `Output: ${usage.outputTokens.toLocaleString('en-IN')}`,
      `Total: ${usage.totalTokens.toLocaleString('en-IN')}`,
    ].join(' | ');
    return `
      <tr>
        <td>${escapeHtml(formatDateTime(row.created_at))}</td>
        <td>${escapeHtml(patient)}</td>
        <td>${escapeHtml(tokenBreakdown)}</td>
        <td>${escapeHtml(usage.creditsDeducted.toLocaleString('en-IN'))}</td>
      </tr>
    `;
  }).join('');

  const statementHtml = `
    <!doctype html>
    <html>
      <head>
        <title>YogiDesk Automation Statement</title>
        <style>
          @page { margin: 0 !important; }
          * { box-sizing: border-box; }
          body { margin: 0; padding: 2cm !important; color: #111827; font-family: Arial, Helvetica, sans-serif; background: #ffffff; }
          @media print {
            @page { margin: 0 !important; }
            body { padding: 2cm !important; }
          }
          .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 18px; }
          .brand-wrap { display: flex; align-items: center; gap: 14px; }
          .logo { width: 46px; height: 46px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px; }
          .title { margin: 0; font-size: 19px; letter-spacing: 0.12em; font-weight: 900; text-transform: uppercase; color: #111827; }
          .subtitle { margin: 5px 0 0; color: #6b7280; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
          .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; margin: 0 0 22px; padding: 15px 16px; background: #fffaf3; border: 1px solid #d1d5db; border-radius: 12px; font-size: 12px; line-height: 1.55; }
          .meta strong { display: block; color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th { background: #f9fafb; color: #4b5563; text-align: left; text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; }
          th, td { padding: 10px 9px; border: 1px solid #e5e7eb; vertical-align: top; }
          td:nth-child(4) { font-weight: 900; color: #b45309; text-align: right; }
          .empty { padding: 30px; text-align: center; color: #6b7280; border: 1px dashed #d1d5db; border-radius: 12px; font-size: 12px; }
          .footer { margin-top: 20px; color: #9ca3af; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand-wrap">
            <img class="logo" src="${window.location.origin}/assets/yogidesk-logo.png" alt="YogiDesk Logo" />
            <div>
              <p class="title">YOGIDESK AUTOMATION STATEMENT</p>
              <p class="subtitle">AI conversation debit ledger</p>
            </div>
          </div>
        </div>
        <div class="meta">
          <div><strong>Clinic Name</strong>${escapeHtml(clinicName || 'Clinic Workspace')}</div>
          <div><strong>Registered Doctor Identity ID</strong>${escapeHtml(displayDocId)}</div>
          <div><strong>Accounting Range</strong>${escapeHtml(rangeText)}</div>
          <div><strong>Generated At</strong>${escapeHtml(new Date().toLocaleString('en-IN'))}</div>
        </div>
        ${rows.length ? `
          <table>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Patient Reference (+91XXXXX)</th>
                <th>Session Token Breakdown</th>
                <th>Final Message Credits Deducted</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        ` : '<div class="empty">No AI usage entries found for the selected date range.</div>'}
        <div class="footer">Generated securely from YogiDesk Automation workspace data.</div>
      </body>
    </html>
  `;

  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.title = `yogidesk-automation-statement-${Date.now()}`;
  document.body.appendChild(frame);

  const frameDocument = frame.contentWindow?.document;
  frameDocument.open();
  frameDocument.write(statementHtml);
  frameDocument.close();

  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => document.body.removeChild(frame), 1000);
  }, 250);
};

const AIUsagePassbook = ({
  rows = [],
  loading = false,
  onRefresh,
  clinicName,
  clinicPhoneNumber,
  className = '',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const visibleRows = useMemo(() => (
    rows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE)
  ), [currentPage, rows]);
  const statementRows = useMemo(() => (
    rows.filter((row) => isWithinRange(row, startDate, endDate))
  ), [endDate, rows, startDate]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(page, 1), totalPages));
  }, [totalPages]);

  const handleDownloadStatement = () => {
    exportUsageStatementPdf({
      rows: statementRows,
      startDate,
      endDate,
      clinicName,
      clinicPhoneNumber,
    });
  };

  return (
    <div className={`w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <MessageSquare size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-950">AI Usage Passbook</h2>
            <p className="text-xs font-bold text-slate-500">Live debit ledger for completed AI conversation sessions.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[150px_150px_auto_auto] lg:items-end">
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</span>
            <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600">
              <CalendarDays size={15} />
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</span>
            <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-600">
              <CalendarDays size={15} />
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none"
              />
            </span>
          </label>
          <button
            type="button"
            onClick={handleDownloadStatement}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={15} />
            Download Statement
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading || !onRefresh}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200" />
            </div>
          ))
        ) : (
          visibleRows.map((row) => {
            const patientText = row.patient_number || 'Patient';
            const usage = getUsage(row);
            return (
              <div key={row.id} className="grid gap-3 rounded-2xl border border-orange-100 bg-[#fffaf3] p-4 text-sm lg:grid-cols-[180px_1fr_220px_130px] lg:items-center">
                <div className="font-black text-slate-950">{formatDateTime(row.created_at)}</div>
                <div className="font-semibold leading-6 text-slate-800">Patient: {patientText}</div>
                <div className="text-xs font-bold leading-5 text-slate-500">
                  Input {usage.inputTokens.toLocaleString('en-IN')} | Output {usage.outputTokens.toLocaleString('en-IN')} | Total {usage.totalTokens.toLocaleString('en-IN')}
                </div>
                <div className="font-bold text-red-600">-{usage.creditsDeducted.toLocaleString('en-IN')} Credits</div>
              </div>
            );
          })
        )}
        {!loading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
            No AI conversation usage found
          </div>
        )}
      </div>

      {!loading && rows.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <p className="text-center text-xs font-black uppercase tracking-widest text-slate-500">
            Page {currentPage} of {totalPages}
          </p>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AIUsagePassbook;
