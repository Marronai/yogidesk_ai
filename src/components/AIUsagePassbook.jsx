import React from 'react';
import { MessageSquare } from 'lucide-react';

const AIUsagePassbook = ({
  rows = [],
  loading = false,
  onRefresh,
  className = '',
}) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <MessageSquare size={20} />
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-950">AI Usage Passbook</h2>
          <p className="text-xs font-bold text-slate-500">Live debit ledger for completed AI conversation sessions.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading || !onRefresh}
        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Refresh
      </button>
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
        rows.map((row) => {
          const dateText = new Date(row.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
          const patientText = row.patient_number || 'Patient';
          const credits = Math.abs(Number(row.credits_deducted ?? row.messages_delta ?? 0));
          return (
            <div key={row.id} className="grid gap-2 rounded-2xl border border-orange-100 bg-[#fffaf3] p-4 text-sm sm:grid-cols-[180px_1fr] sm:items-center">
              <div className="font-black text-slate-950">{dateText}</div>
              <div className="font-semibold leading-6 text-slate-800">
                Patient: {patientText} | AI Conversation Session Completed: -{credits.toLocaleString('en-IN')} Credits Deducted
              </div>
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
  </div>
);

export default AIUsagePassbook;
