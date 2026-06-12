const axios = require('axios');

const BREVO_TRANSACTIONAL_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
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

const buildInvoiceEmailHtml = (values) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YogiDesk AI Credit Statement</title>
</head>
<body style="margin:0;background:#fafafa;color:#171717;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;font-size:1px;color:#fafafa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Your YogiDesk AI message credits invoice confirmation for ${escapeHtml(values.ALLOCATED_MESSAGES)} messages.
  </div>
  <div class="bg-neutral-50" style="background:#fafafa;padding:24px;">
    <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;overflow:hidden;">
      <div class="bg-orange-500" style="height:8px;background:#f97316;"></div>
      <div style="padding:30px;">
        <div style="border-bottom:1px solid #f5f5f5;padding-bottom:22px;margin-bottom:28px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:48px;height:48px;border-radius:12px;background:#f97316;color:#ffffff;text-align:center;font-size:22px;font-weight:900;">Y</td>
                    <td style="padding-left:12px;">
                      <div style="font-size:25px;font-weight:900;letter-spacing:-0.02em;color:#0a0a0a;line-height:1;">
                        Yogi<span class="text-orange-500" style="color:#f97316;">Desk</span>
                      </div>
                      <div style="font-size:12px;font-weight:600;color:#737373;margin-top:5px;">Advanced AI Assistant for Healthcare Workspaces</div>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align:middle;text-align:right;">
                <div style="font-size:19px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#0a0a0a;">AI Credit Statement</div>
                <div style="font-size:14px;font-weight:800;color:#f97316;margin-top:5px;">#INV-${escapeHtml(values.INVOICE_NUMBER)}</div>
              </td>
            </tr>
          </table>
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 14px;margin-bottom:22px;">
          <tr>
            <td width="50%" style="background:#fafafa;border:1px solid #f5f5f5;border-radius:12px;padding:16px;vertical-align:top;">
              <div style="font-size:11px;font-weight:900;color:#a3a3a3;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:9px;">Billed To (Clinic Workspace):</div>
              <div style="font-size:16px;font-weight:900;color:#0a0a0a;margin-bottom:6px;">${escapeHtml(values.CLINIC_NAME)}</div>
              <div style="font-size:14px;color:#525252;line-height:1.5;"><strong>Doc Ref:</strong> YOGI-DOC-${escapeHtml(values.CLINIC_PHONE)}</div>
              <div style="font-size:14px;color:#525252;line-height:1.5;"><strong>Contact:</strong> +91 ${escapeHtml(values.CLINIC_PHONE)}</div>
            </td>
            <td width="14"></td>
            <td width="50%" style="background:#fafafa;border:1px solid #f5f5f5;border-radius:12px;padding:16px;vertical-align:top;">
              <div style="font-size:11px;font-weight:900;color:#a3a3a3;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:9px;">Payment Audit Trail:</div>
              <div style="font-size:14px;color:#525252;line-height:1.5;"><strong>Date:</strong> ${escapeHtml(values.PAYMENT_DATE)}</div>
              <div style="font-size:14px;color:#525252;line-height:1.5;"><strong>Gateway reference:</strong> ${escapeHtml(values.RAZORPAY_TXN_ID)}</div>
              <div style="display:inline-block;margin-top:12px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;color:#047857;font-size:11px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;padding:6px 12px;">Paid via Razorpay</div>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;margin-bottom:28px;">
          <tr style="background:#0a0a0a;color:#ffffff;">
            <th align="left" style="padding:15px;font-size:11px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;">Operational Ledger Item Description</th>
            <th align="center" style="padding:15px;font-size:11px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;">Allocated Units</th>
            <th align="right" style="padding:15px;font-size:11px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;">Net Amount</th>
          </tr>
          <tr>
            <td style="padding:16px;border-top:1px solid #e5e5e5;">
              <div style="font-size:16px;font-weight:900;color:#0a0a0a;">${escapeHtml(values.PLAN_NAME)}</div>
              <div style="font-size:12px;color:#737373;margin-top:5px;">Prepaid core operational wallet top-up session bundle allocation.</div>
            </td>
            <td align="center" style="padding:16px;border-top:1px solid #e5e5e5;font-size:14px;color:#171717;"><span style="font-weight:900;color:#059669;">+${escapeHtml(values.ALLOCATED_MESSAGES)}</span> Messages</td>
            <td align="right" style="padding:16px;border-top:1px solid #e5e5e5;font-size:15px;font-weight:900;color:#0a0a0a;">Rs. ${escapeHtml(values.RECHARGE_AMOUNT)}</td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border-bottom:1px solid #f5f5f5;padding-bottom:22px;margin-bottom:22px;">
          <tr>
            <td style="vertical-align:bottom;">
              <div style="background:#fafafa;border:1px solid #f5f5f5;border-radius:12px;padding:16px;text-align:center;display:inline-block;min-width:240px;">
                <div style="display:inline-block;border:2px solid #10b981;border-radius:6px;background:#ffffff;color:#059669;font-size:10px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;padding:2px 8px;">✓ Verified</div>
                <div style="font-family:'Brush Script MT','Segoe Script',cursive;font-size:28px;color:#0a0a0a;margin-top:8px;">Avinash Kumar Jha</div>
                <div style="font-size:10px;font-weight:900;color:#a3a3a3;letter-spacing:0.1em;text-transform:uppercase;">Digital Growth Consultant</div>
              </div>
            </td>
            <td style="vertical-align:bottom;width:285px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:5px 0;color:#737373;">Subtotal Base Fee:</td><td align="right" style="padding:5px 0;color:#262626;font-weight:700;">Rs. ${escapeHtml(values.RECHARGE_AMOUNT)}</td></tr>
                <tr><td style="padding:5px 0;color:#737373;">Meta Pipeline & Gateway Taxes:</td><td align="right" style="padding:5px 0;color:#262626;font-weight:700;">Rs. ${escapeHtml(values.META_FEE)}</td></tr>
                <tr><td style="padding-top:12px;border-top:2px dashed #e5e5e5;color:#0a0a0a;font-size:16px;font-weight:900;">Total Settled:</td><td align="right" style="padding-top:12px;border-top:2px dashed #e5e5e5;color:#f97316;font-size:22px;font-weight:900;">Rs. ${escapeHtml(values.TOTAL_AMOUNT)}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <div style="font-size:12px;color:#a3a3a3;text-align:center;line-height:1.5;">
          <div>Thank you for scaling your automated customer and virtual patient flows with YogiDesk platforms.</div>
          <div style="font-family:Consolas,monospace;font-size:10px;color:#d4d4d4;letter-spacing:0.1em;text-transform:uppercase;margin-top:5px;">System Document Secure Token Check: ${escapeHtml(values.RAZORPAY_TXN_ID)}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

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
    const apiKey = String(process.env.RECHARGE_BREVO_KEY || '').trim();
    if (!apiKey) {
      console.warn('AI credit invoice email skipped: RECHARGE_BREVO_KEY is not configured.', { userId, invoiceNumber });
      return { invoiceNumber, sent: false, skipped: true };
    }

    const profile = await resolveClinicProfile({ db, supabaseAdmin, userId, fallback: fallbackDoctor });
    const doctorEmail = String(profile.email || fallbackDoctor.email || recharge?.doctorEmail || '').trim().toLowerCase();
    const clinicName = profile.clinicName || fallbackDoctor.clinicName || recharge?.clinicName || 'YogiDesk Clinic Workspace';

    if (!EMAIL_PATTERN.test(doctorEmail)) {
      console.warn('AI credit invoice email skipped: missing/invalid doctor email.', { userId, doctorEmail });
      return { invoiceNumber, sent: false, skipped: true };
    }

    const values = {
      CLINIC_NAME: clinicName,
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

    const response = await axios.post(BREVO_TRANSACTIONAL_EMAIL_URL, {
      sender: { name: 'YogiDesk Billing', email: 'billing@yogidesk-ai.com' },
      to: [{ email: doctorEmail, name: clinicName }],
      subject: 'Your YogiDesk AI Message Credits Invoice Confirmation! 🧾⚡',
      htmlContent: buildInvoiceEmailHtml(values),
    }, {
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      timeout: 10000,
    });

    const messageId = response.data?.messageId || response.data?.messageIds?.[0] || 'accepted-no-message-id';
    console.log(`AI credit invoice ${invoiceNumber} accepted by Brevo for ${doctorEmail}. messageId=${messageId}`);
    return { invoiceNumber, sent: true, skipped: false, messageId };
  } catch (error) {
    console.error('AI credit invoice Brevo dispatch failed, keeping execution alive:', error.response?.data || error.message || error);
    return { invoiceNumber, sent: false, skipped: false, error };
  }
};

module.exports = {
  sendAiCreditInvoiceEmail,
};
