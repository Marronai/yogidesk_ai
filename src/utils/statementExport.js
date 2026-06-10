import api from './api';
import { supabase } from '../config/supabaseClient';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const resolveClinicMeta = async () => {
  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult?.user?.id || localStorage.getItem('user_id');
  const fallbackName = localStorage.getItem('user_name') || userResult?.user?.user_metadata?.full_name || 'Doctor';
  const fallbackClinic = localStorage.getItem('clinic_name') || localStorage.getItem('user_clinic_name') || 'Clinic Workspace';

  if (!userId) return { owner: fallbackName, clinic: fallbackClinic };

  try {
    const { data } = await api.get('/profile/context', { params: { userId } });
    const profile = data?.profile || {};
    return {
      owner: profile.name || profile.full_name || fallbackName,
      clinic: profile.clinic_name || profile.business_name || profile.clinicName || fallbackClinic,
    };
  } catch {
    return { owner: fallbackName, clinic: fallbackClinic };
  }
};

export const exportFinancialStatementPdf = async ({ rows = [], filenamePrefix = 'yogidesk-statement', title = 'Financial Statement' }) => {
  const clinicMeta = await resolveClinicMeta();
  const tableRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(row.activity)}</td>
      <td>${escapeHtml(row.value)}</td>
      <td>${escapeHtml(row.status || 'Success')}</td>
    </tr>
  `).join('');

  const statementHtml = `
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          @page { margin: 22mm; }
          * { box-sizing: border-box; }
          body { margin: 0; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
          .header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #f97316; padding-bottom: 18px; margin-bottom: 18px; }
          .header img { height: 42px; width: auto; object-fit: contain; }
          .brand { font-size: 20px; font-weight: 900; margin: 0; }
          .subtitle { margin: 4px 0 0; color: #64748b; font-size: 12px; font-weight: 700; }
          .meta { margin: 0 0 22px; padding: 14px 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; font-size: 12px; line-height: 1.7; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f8fafc; color: #64748b; text-align: left; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
          th, td { padding: 11px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          td:nth-child(3) { font-weight: 800; color: #0f172a; }
          .empty { padding: 30px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 12px; }
          .footer { margin-top: 22px; color: #94a3b8; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${window.location.origin}/logo.png" alt="YogiDesk AI Logo" />
          <div>
            <p class="brand">Yogidesk.ai - Official Financial Statement</p>
            <p class="subtitle">${escapeHtml(title)}</p>
          </div>
        </div>
        <div class="meta">
          <strong>Clinic Owner Workspace:</strong> ${escapeHtml(clinicMeta.clinic)} / ${escapeHtml(clinicMeta.owner)}<br />
          <strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString('en-IN'))}
        </div>
        ${rows.length ? `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Activity / Package</th>
                <th>Messages / Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        ` : '<div class="empty">No statement entries available.</div>'}
        <div class="footer">Generated securely from the active Yogidesk.ai workspace.</div>
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
  frame.title = `${filenamePrefix}-${Date.now()}`;
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
