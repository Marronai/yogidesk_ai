const { supabase, supabaseAdmin } = require('../config/supabase');
const { sendDirectBrandMail } = require('./mailService');

const RATE_CARD = { MARKETING: 1.30, UTILITY: 0.20, AUTHENTICATION: 0.20 };

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeCategory = (category) => {
  const normalized = String(category || 'UTILITY').toUpperCase();
  return RATE_CARD[normalized] ? normalized : 'UTILITY';
};

const getRefundAmount = (category) => RATE_CARD[normalizeCategory(category)];

const getMetaMessageId = (metaResult = {}) => (
  metaResult.message_id ||
  metaResult.messages?.[0]?.id ||
  metaResult.response?.messages?.[0]?.id ||
  metaResult.response?.messages?.[0]?.message_id ||
  null
);

const getDb = () => supabaseAdmin || supabase;

const findDoctorProfile = async (userId) => {
  const db = getDb();
  if (!db?.from || !userId) return null;

  for (const table of ['doctor_profiles', 'users']) {
    for (const select of ['id,email,name,businessName,business_name', 'id,email,name']) {
      const { data, error } = await db.from(table).select(select).eq('id', userId).maybeSingle();
      if (data) return data;
      if (!error) break;
    }
  }

  return null;
};

const findMessageContext = async (messageId) => {
  const db = getDb();
  if (!db?.from || !messageId) return null;

  const { data, error } = await db
    .from('inbox_messages')
    .select('id,workspace_id,metadata')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Refund message context lookup failed:', error.message || error);
    return null;
  }

  return (Array.isArray(data) ? data : []).find((row) => {
    const metadata = row.metadata || {};
    const metaResult = metadata.meta_result || {};
    return [
      metadata.message_id,
      metadata.meta_message_id,
      getMetaMessageId(metaResult)
    ].filter(Boolean).map(String).includes(String(messageId));
  }) || null;
};

const sendRefundEmail = async ({ to, doctorName, templateName, templateId, refundAmount, walletBalance }) => {
  if (!to) return false;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background:#f6f7fb; padding:24px; color:#111827;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
        <div style="background:#ff6b00; color:#ffffff; padding:20px 24px;">
          <h1 style="font-size:20px; line-height:1.3; margin:0;">Refund Successful</h1>
          <p style="font-size:14px; margin:6px 0 0;">Failed Message Delivery Notice</p>
        </div>
        <div style="padding:24px;">
          <p style="font-size:15px; line-height:1.6; margin:0 0 16px;">Dear ${escapeHtml(doctorName || 'Doctor')},</p>
          <p style="font-size:15px; line-height:1.6; margin:0 0 20px;">A WhatsApp template message could not be delivered, so the message charge has been credited back to your Yogi Desk wallet.</p>
          <table style="width:100%; border-collapse:collapse; font-size:14px;">
            <tr><td style="padding:10px; border:1px solid #e5e7eb; color:#6b7280;">Failed Template</td><td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">${escapeHtml(templateName || templateId || 'WhatsApp Template')}</td></tr>
            <tr><td style="padding:10px; border:1px solid #e5e7eb; color:#6b7280;">Template ID</td><td style="padding:10px; border:1px solid #e5e7eb;">${escapeHtml(templateId || 'N/A')}</td></tr>
            <tr><td style="padding:10px; border:1px solid #e5e7eb; color:#6b7280;">Refund Amount</td><td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">Rs. ${Number(refundAmount).toFixed(2)}</td></tr>
            <tr><td style="padding:10px; border:1px solid #e5e7eb; color:#6b7280;">Reason</td><td style="padding:10px; border:1px solid #e5e7eb;">Delivery Failed / Undelivered Number</td></tr>
            <tr><td style="padding:10px; border:1px solid #e5e7eb; color:#6b7280;">Available Wallet Balance</td><td style="padding:10px; border:1px solid #e5e7eb; font-weight:600;">Rs. ${Number(walletBalance || 0).toFixed(2)}</td></tr>
          </table>
          <p style="font-size:12px; line-height:1.6; color:#6b7280; margin:20px 0 0;">Refunds are processed automatically within 24 hours of delivery status failure notification.</p>
        </div>
      </div>
    </div>
  `;

  return sendDirectBrandMail(
    to,
    '[Yogi Desk] Refund Successful: Failed Message Delivery Notice',
    htmlContent,
    'system'
  );
};

const processFailedDeliveryRefund = async ({
  userId,
  messageId,
  templateCategory,
  templateName,
  templateId,
  reason = 'Delivery Failed / Undelivered Number',
  source = 'webhook',
  rawStatus = 'failed'
}) => {
  const db = getDb();
  if (!db?.from || !messageId) return { refunded: false, reason: 'missing_context' };

  let resolvedUserId = userId || null;
  let resolvedCategory = templateCategory || null;
  let resolvedTemplateName = templateName || null;
  let resolvedTemplateId = templateId || null;

  if (!resolvedUserId || !resolvedCategory || !resolvedTemplateName) {
    const messageContext = await findMessageContext(messageId);
    const metadata = messageContext?.metadata || {};
    resolvedUserId = resolvedUserId || messageContext?.workspace_id || metadata.user_id || null;
    resolvedCategory = resolvedCategory || metadata.template_category || metadata.category || null;
    resolvedTemplateName = resolvedTemplateName || metadata.template_name || null;
    resolvedTemplateId = resolvedTemplateId || metadata.template_id || null;
  }

  if (!resolvedUserId) return { refunded: false, reason: 'missing_user_id' };

  const refundAmount = getRefundAmount(resolvedCategory);
  const processedAt = new Date().toISOString();

  const { data: existingRefund, error: existingError } = await db
    .from('wallet_transactions')
    .select('id')
    .eq('user_id', resolvedUserId)
    .eq('transaction_type', 'REFUND')
    .eq('metadata->>message_id', String(messageId))
    .maybeSingle();

  if (existingError) {
    console.error('Refund duplicate check failed:', existingError.message || existingError);
  }
  if (existingRefund?.id) return { refunded: false, reason: 'already_refunded' };

  const { error: rpcError } = await db.rpc('increment_wallet_balance', {
    user_id: resolvedUserId,
    amount: refundAmount
  });

  if (rpcError) throw rpcError;

  const { data: wallet } = await db
    .from('wallets')
    .select('balance')
    .eq('user_id', resolvedUserId)
    .maybeSingle();

  const walletBalance = Number(wallet?.balance || 0);

  const { error: transactionError } = await db.from('wallet_transactions').insert({
    user_id: resolvedUserId,
    amount: refundAmount,
    transaction_type: 'REFUND',
    description: `Automatic refund for failed template delivery reference: ${messageId}`,
    metadata: {
      status: 'FAILED_DELIVERY',
      message_id: String(messageId),
      template_id: resolvedTemplateId || null,
      template_name: resolvedTemplateName || 'WhatsApp Template',
      category: normalizeCategory(resolvedCategory),
      reason,
      source,
      raw_status: rawStatus,
      processed_at: processedAt,
      buffer_window_days: 3
    },
    created_at: processedAt
  });

  if (transactionError) throw transactionError;

  const doctor = await findDoctorProfile(resolvedUserId);
  await sendRefundEmail({
    to: doctor?.email,
    doctorName: doctor?.name,
    templateName: resolvedTemplateName,
    templateId: resolvedTemplateId,
    refundAmount,
    walletBalance
  });

  return {
    refunded: true,
    userId: resolvedUserId,
    messageId,
    refundAmount,
    walletBalance
  };
};

module.exports = {
  getMetaMessageId,
  getRefundAmount,
  processFailedDeliveryRefund
};
