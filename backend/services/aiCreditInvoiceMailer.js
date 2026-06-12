const fs = require('fs');
const path = require('path');
const htmlPdf = require('html-pdf-node');
const nodemailer = require('nodemailer');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatAmount = (value) => Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatInteger = (value) => Number(value || 0).toLocaleString('en-IN');

const formatPaymentDate = (value = new Date()) => new Date(value).toLocaleString('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Kolkata',
}).replace(/\b(am|pm)\b/i, (match) => match.toLowerCase());

const createInvoiceNumber = () => `YOGI-INV-${Date.now().toString().slice(-6)}`;

const normalizePhoneForDisplay = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10);
  return digits || 'Not available';
};

const getLogoDataUri = () => {
  const candidates = [
    path.join(__dirname, '../../public/assets/yogidesk-logo.png'),
    path.join(__dirname, '../../yogidesk-logo.png'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return `data:image/png;base64,${fs.readFileSync(candidate).toString('base64')}`;
      }
    } catch (error) {
      console.warn('YogiDesk invoice logo load skipped:', error.message || error);
    }
  }
  return '';
};

const resolveClinicProfile = async ({ db, supabaseAdmin, userId, fallback = {} }) => {
  const base = {
    clinicName: fallback.clinicName || fallback.clinic_name || fallback.doctorName || fallback.name || 'YogiDesk Clinic Workspace',
    doctorName: fallback.doctorName || fallback.name || 'Doctor',
    email: fallback.email || fallback.doctorEmail || '',
    phone: fallback.phone || fallback.doctorPhone || '',
  };

  if (!userId || !db?.from) return base;

  for (const table of ['doctor_profiles', 'profiles']) {
    try {
      const { data, error } = await db
        .from(table)
        .select('id,name,email,phone,phone_number,mobile,clinic_name')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data?.id) {
        return {
          clinicName: data.clinic_name || data.name || base.clinicName,
          doctorName: data.name || base.doctorName,
          email: data.email || base.email,
          phone: data.phone_number || data.phone || data.mobile || base.phone,
        };
      }
    } catch (error) {
      console.warn(`AI invoice profile lookup skipped in ${table}:`, error.message || error);
    }
  }

  try {
    if (supabaseAdmin?.auth?.admin?.getUserById) {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      const user = data?.user;
      if (!error && user?.id) {
        return {
          clinicName: user.user_metadata?.clinic_name || user.user_metadata?.clinicName || base.clinicName,
          doctorName: user.user_metadata?.full_name || user.user_metadata?.name || base.doctorName,
          email: user.email || base.email,
          phone: user.user_metadata?.phone || base.phone,
        };
      }
    }
  } catch (error) {
    console.warn('AI invoice auth profile lookup skipped:', error.message || error);
  }

  return base;
};

const buildInvoiceHtml = (values) => {
  const logoDataUri = getLogoDataUri();
  const logoMarkup = logoDataUri
    ? `<img src="${logoDataUri}" alt="YogiDesk logo" class="brand-logo">`
    : '<div class="brand-fallback">Y</div>';

  const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YogiDesk - AI Credits Invoice</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; background: #fafafa; color: #171717; font-family: Arial, Helvetica, sans-serif; padding: 24px; }
    .invoice { max-width: 768px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e5e5; border-radius: 16px; overflow: hidden; position: relative; }
    .top-strip { height: 8px; background: #f97316; }
    .inner { padding: 32px; }
    .header { display: flex; justify-content: space-between; gap: 24px; align-items: center; border-bottom: 1px solid #f5f5f5; padding-bottom: 24px; margin-bottom: 32px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .brand-logo, .brand-fallback { width: 48px; height: 48px; border-radius: 12px; object-fit: contain; background: #f97316; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 900; }
    .brand-name { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; color: #0a0a0a; line-height: 1; }
    .brand-name span { color: #f97316; }
    .tagline { color: #737373; font-size: 12px; font-weight: 600; margin: 4px 0 0; }
    .statement { text-align: right; }
    .statement h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    .statement p { margin: 4px 0 0; color: #f97316; font-size: 14px; font-weight: 800; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .panel { background: #fafafa; border: 1px solid #f5f5f5; border-radius: 12px; padding: 16px; }
    .label { color: #a3a3a3; font-size: 11px; font-weight: 900; letter-spacing: 0.1em; margin: 0 0 10px; text-transform: uppercase; }
    .clinic { color: #0a0a0a; font-size: 16px; font-weight: 900; margin: 0 0 6px; }
    .muted { color: #525252; font-size: 14px; line-height: 1.5; margin: 0; }
    .paid { display: inline-flex; margin-top: 14px; border: 1px solid #a7f3d0; background: #ecfdf5; color: #047857; border-radius: 999px; padding: 6px 12px; font-size: 11px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase; }
    table { border-collapse: collapse; width: 100%; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden; margin-bottom: 32px; }
    thead { background: #0a0a0a; color: #fff; }
    th { padding: 16px; font-size: 11px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
    td { padding: 16px; border-top: 1px solid #e5e5e5; vertical-align: middle; font-size: 14px; }
    .desc-title { color: #0a0a0a; font-size: 16px; font-weight: 900; margin: 0; }
    .desc-sub { color: #737373; font-size: 12px; margin: 5px 0 0; }
    .center { text-align: center; }
    .right { text-align: right; }
    .messages { color: #059669; font-weight: 900; }
    .settlement { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; border-bottom: 1px solid #f5f5f5; padding-bottom: 24px; margin-bottom: 24px; }
    .verified { background: #fafafa; border: 1px solid #f5f5f5; border-radius: 12px; padding: 16px; text-align: center; min-width: 250px; }
    .stamp { display: inline-block; color: #059669; border: 2px solid #10b981; background: #fff; border-radius: 6px; padding: 2px 8px; font-family: Consolas, monospace; font-size: 10px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; transform: rotate(-6deg); }
    .signature { font-family: 'Caveat', cursive; font-size: 28px; color: #0a0a0a; margin-top: 8px; }
    .role { color: #a3a3a3; font-size: 10px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
    .totals { width: 270px; font-size: 14px; }
    .total-row { display: flex; justify-content: space-between; gap: 16px; color: #737373; margin-bottom: 10px; }
    .total-row strong { color: #262626; }
    .grand { border-top: 2px dashed #e5e5e5; padding-top: 12px; margin-top: 12px; color: #0a0a0a; font-size: 16px; font-weight: 900; }
    .grand strong { color: #f97316; font-size: 22px; }
    .footer { color: #a3a3a3; text-align: center; font-size: 12px; line-height: 1.5; }
    .token { color: #d4d4d4; font-family: Consolas, monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 4px; }
    @media (max-width: 640px) {
      body { padding: 12px; }
      .inner { padding: 20px; }
      .header, .settlement { display: block; }
      .statement { text-align: left; margin-top: 18px; }
      .grid { grid-template-columns: 1fr; gap: 14px; }
      table, thead, tbody, tr, th, td { display: block; width: 100%; }
      thead { display: none; }
      td { text-align: left !important; }
      .totals, .verified { width: 100%; margin-top: 18px; min-width: 0; }
    }
    @media print {
      @page { margin: 0 !important; }
      body { padding: 1.5cm !important; background-color: #ffffff !important; }
      .invoice { border-radius: 0; box-shadow: none; }
      a[href]::after { content: "" !important; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="top-strip"></div>
    <div class="inner">
      <div class="header">
        <div class="brand">
          ${logoMarkup}
          <div>
            <div class="brand-name">Yogi<span>Desk</span></div>
            <p class="tagline">Advanced AI Assistant for Healthcare Workspaces</p>
          </div>
        </div>
        <div class="statement">
          <h1>AI Credit Statement</h1>
          <p>#INV-{{INVOICE_NUMBER}}</p>
        </div>
      </div>
      <div class="grid">
        <div class="panel">
          <p class="label">Billed To (Clinic Workspace):</p>
          <p class="clinic">{{CLINIC_NAME}}</p>
          <p class="muted"><strong>Doc Ref:</strong> YOGI-DOC-{{CLINIC_PHONE}}</p>
          <p class="muted"><strong>Contact:</strong> +91 {{CLINIC_PHONE}}</p>
        </div>
        <div class="panel">
          <p class="label">Payment Audit Trail:</p>
          <p class="muted"><strong>Date:</strong> {{PAYMENT_DATE}}</p>
          <p class="muted"><strong>Gateway reference:</strong> {{RAZORPAY_TXN_ID}}</p>
          <span class="paid">● Paid via Razorpay</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="right">Operational Ledger Item Description</th>
            <th class="center">Allocated Units</th>
            <th class="right">Net Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <p class="desc-title">{{PLAN_NAME}}</p>
              <p class="desc-sub">Prepaid core operational wallet top-up session bundle allocation.</p>
            </td>
            <td class="center"><span class="messages">+{{ALLOCATED_MESSAGES}}</span> Messages</td>
            <td class="right"><strong>Rs. {{RECHARGE_AMOUNT}}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="settlement">
        <div class="verified">
          <div class="stamp">✓ Verified</div>
          <div class="signature">Avinash Kumar Jha</div>
          <div class="role">Digital Growth Consultant</div>
        </div>
        <div class="totals">
          <div class="total-row"><span>Subtotal Base Fee:</span><strong>Rs. {{RECHARGE_AMOUNT}}</strong></div>
          <div class="total-row"><span>Meta Pipeline & Gateway Taxes:</span><strong>Rs. {{META_FEE}}</strong></div>
          <div class="total-row grand"><span>Total Settled:</span><strong>Rs. {{TOTAL_AMOUNT}}</strong></div>
        </div>
      </div>
      <div class="footer">
        <div>Thank you for scaling your automated customer and virtual patient flows with YogiDesk platforms.</div>
        <div class="token">System Document Secure Token Check: {{RAZORPAY_TXN_ID}}</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  return Object.entries(values).reduce((html, [key, value]) => (
    html.replace(new RegExp(`{{${key}}}`, 'g'), escapeHtml(value))
  ), template);
};

const createTransporter = () => {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 587);
  const user = process.env.SMTP_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.MAIL_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth: { user, pass },
  });
};

const generateInvoicePdf = async (html) => htmlPdf.generatePdf(
  { content: html },
  {
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
    preferCSSPageSize: true,
  }
);

const sendAiCreditInvoiceEmail = async ({
  db,
  supabaseAdmin,
  userId,
  recharge,
  razorpayPaymentId,
  paidAt = new Date(),
  fallbackDoctor = {},
}) => {
  const invoiceNumber = createInvoiceNumber();

  try {
    const profile = await resolveClinicProfile({ db, supabaseAdmin, userId, fallback: fallbackDoctor });
    const recipient = String(profile.email || fallbackDoctor.email || recharge?.doctorEmail || '').trim().toLowerCase();
    if (!EMAIL_PATTERN.test(recipient)) {
      console.warn('AI credit invoice email skipped: missing/invalid doctor email.', { userId, recipient });
      return { invoiceNumber, sent: false, skipped: true };
    }

    const values = {
      CLINIC_NAME: profile.clinicName,
      CLINIC_PHONE: normalizePhoneForDisplay(profile.phone || fallbackDoctor.phone || recharge?.doctorPhone),
      RAZORPAY_TXN_ID: razorpayPaymentId,
      PAYMENT_DATE: formatPaymentDate(paidAt),
      PLAN_NAME: recharge?.packageLabel || 'Custom AI Messages',
      ALLOCATED_MESSAGES: formatInteger(recharge?.aiMessages),
      RECHARGE_AMOUNT: formatAmount(recharge?.subtotal),
      META_FEE: formatAmount(recharge?.metaFee),
      TOTAL_AMOUNT: formatAmount(recharge?.totalAmount),
      INVOICE_NUMBER: invoiceNumber,
    };

    const html = buildInvoiceHtml(values);
    const pdfBuffer = await generateInvoicePdf(html);
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('AI credit invoice email skipped: SMTP_HOST, SMTP_USER, or SMTP_PASS is not configured.', { userId, invoiceNumber });
      return { invoiceNumber, sent: false, skipped: true };
    }

    await transporter.sendMail({
      from: {
        name: process.env.SMTP_FROM_NAME || process.env.BREVO_FROM_NAME || 'YogiDesk AI',
        address: process.env.SMTP_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || process.env.SMTP_USER,
      },
      to: recipient,
      subject: 'Your YogiDesk AI Message Credits Invoice Confirmation! 🧾⚡',
      text: `Hi ${profile.doctorName || 'Doctor'}, your YogiDesk AI wallet has been refreshed with ${values.ALLOCATED_MESSAGES} message credits. Your invoice ${invoiceNumber} is attached as a PDF.`,
      html: `
        <div style="font-family: Arial, Helvetica, sans-serif; background:#fafafa; padding:24px; color:#171717;">
          <div style="max-width:620px; margin:0 auto; background:#ffffff; border:1px solid #e5e5e5; border-radius:14px; overflow:hidden;">
            <div style="height:6px; background:#f97316;"></div>
            <div style="padding:28px;">
              <h2 style="margin:0 0 12px; color:#0a0a0a;">Your AI message wallet is refreshed.</h2>
              <p style="margin:0 0 14px; color:#525252; line-height:1.6;">Hi ${escapeHtml(profile.doctorName || 'Doctor')},</p>
              <p style="margin:0 0 14px; color:#525252; line-height:1.6;">Your YogiDesk AI credits purchase was successful. We have added <strong>${values.ALLOCATED_MESSAGES}</strong> message credits to your active workspace wallet.</p>
              <p style="margin:0 0 18px; color:#525252; line-height:1.6;">The branded PDF invoice is attached for your billing records.</p>
              <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:14px; color:#9a3412; font-weight:700;">Razorpay Reference: ${escapeHtml(razorpayPaymentId)}</div>
            </div>
          </div>
        </div>
      `,
      attachments: [{
        filename: `YogiDesk_Invoice_${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });

    console.log(`AI credit invoice ${invoiceNumber} mailed to ${recipient}.`);
    return { invoiceNumber, sent: true, skipped: false };
  } catch (error) {
    console.error('AI credit invoice PDF/email dispatch failed:', {
      userId,
      invoiceNumber,
      razorpayPaymentId,
      message: error.message || error,
    });
    return { invoiceNumber, sent: false, skipped: false, error };
  }
};

module.exports = {
  sendAiCreditInvoiceEmail,
};
