const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { processFailedDeliveryRefund } = require('../services/refundService');

const getVerifyToken = () => (
  process.env.META_WEBHOOK_VERIFY_TOKEN ||
  process.env.META_VERIFY_TOKEN ||
  process.env.WHATSAPP_VERIFY_TOKEN ||
  ''
);

const getAppSecret = () => (
  process.env.META_WEBHOOK_APP_SECRET ||
  process.env.META_APP_SECRET ||
  process.env.WHATSAPP_APP_SECRET ||
  ''
);

const verifySignature = (req) => {
  const secret = getAppSecret();
  const signature = String(req.get('x-hub-signature-256') || '').trim();
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
    .digest('hex')}`;

  const actual = Buffer.from(signature, 'utf8');
  const target = Buffer.from(expected, 'utf8');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
};

const normalizeStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'PENDING_REVIEW' || normalized === 'IN_REVIEW' ? 'PENDING' : normalized;
};

const getTemplateUpdates = (payload = {}) => {
  if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];

  return payload.entry.flatMap((entry) => (
    Array.isArray(entry.changes)
      ? entry.changes.map((change) => {
        if (change.field !== 'message_template_status_update' && change.field !== 'message_template') return null;
        const value = change.value || {};
        const template = value.message_template_status_update || value.message_template_status || value.message_template || value;
        const status = normalizeStatus(template.status || template.event || value.event);
        const businessAccountId = String(template.whatsapp_business_account_id || value.whatsapp_business_account_id || value.waba_id || entry.id || '').trim();
        const templateId = String(template.id || template.message_template_id || value.message_template_id || '').trim();
        const templateName = String(template.name || template.message_template_name || value.message_template_name || value.template_name || '').trim();
        return businessAccountId && status && (templateId || templateName)
          ? { businessAccountId, templateId, templateName, status }
          : null;
      }).filter(Boolean)
      : []
  ));
};

const getDeliveryStatusUpdates = (payload = {}) => {
  if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];

  return payload.entry.flatMap((entry) => (
    Array.isArray(entry.changes)
      ? entry.changes.flatMap((change) => {
        if (change.field !== 'messages') return [];
        const value = change.value || {};
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];

        return statuses.map((statusRow) => {
          const conversation = statusRow.conversation || {};
          const pricing = statusRow.pricing || {};
          const metadata = statusRow.metadata || value.metadata || {};
          const template = statusRow.template || metadata.template || {};
          const rawStatus = String(statusRow.status || '').toLowerCase();

          return {
            status: rawStatus,
            userId: metadata.user_id || metadata.doctor_id || value.user_id || null,
            messageId: statusRow.id || statusRow.message_id || null,
            templateCategory: pricing.category || metadata.template_category || metadata.category || template.category || null,
            templateName: metadata.template_name || template.name || null,
            templateId: metadata.template_id || template.id || conversation.id || null,
            reason: statusRow.errors?.[0]?.title || statusRow.errors?.[0]?.message || 'Delivery Failed / Undelivered Number'
          };
        }).filter((update) => update.status === 'failed' && update.messageId);
      })
      : []
  ));
};

const findClinic = async (businessAccountId) => {
  const db = supabaseAdmin || supabase;
  let result = await db.from('doctor_profiles').select('id').eq('meta_waba_id', businessAccountId).maybeSingle();
  if (result.error) {
    result = await db.from('doctor_profiles').select('id').eq('whatsapp_business_account_id', businessAccountId).maybeSingle();
  }
  return result.data || null;
};

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === getVerifyToken()) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Forbidden');
};

exports.handleWebhook = async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(403).send('Invalid signature');
  }

  res.sendStatus(200);

  try {
    const db = supabaseAdmin || supabase;
    for (const update of getTemplateUpdates(req.body)) {
      const clinic = await findClinic(update.businessAccountId);
      if (!clinic?.id) continue;

      let query = db.from('whatsapp_templates').update({ status: update.status }).eq('user_id', clinic.id);
      query = update.templateId
        ? query.or(`meta_template_id.eq.${update.templateId},template_name.eq.${update.templateName}`)
        : query.eq('template_name', update.templateName);
      const { error } = await query;
      if (error) console.error('Webhook template status update failed:', error.message || error);
    }

    for (const update of getDeliveryStatusUpdates(req.body)) {
      await processFailedDeliveryRefund({
        userId: update.userId,
        messageId: update.messageId,
        templateCategory: update.templateCategory,
        templateName: update.templateName,
        templateId: update.templateId,
        reason: update.reason,
        source: 'meta_webhook',
        rawStatus: update.status
      });
    }
  } catch (error) {
    console.error('Webhook handler error:', error.message || error);
  }
};
