const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { processFailedDeliveryRefund } = require('../services/refundService');

const getVerifyToken = () => (
  process.env.META_WEBHOOK_VERIFY_TOKEN ||
  process.env.META_VERIFY_TOKEN ||
  process.env.WHATSAPP_VERIFY_TOKEN ||
  ''
);

const getAppSecret = () => String(process.env.WHATSAPP_APP_SECRET || '').trim();

if (!getAppSecret()) {
  console.warn('[YogiDesk Security] WHATSAPP_APP_SECRET is not configured. WhatsApp webhook POST ingestion will reject unsigned requests until the app secret is set.');
}

const verifySignature = (req) => {
  const secret = getAppSecret();
  const signature = String(req.get('x-hub-signature-256') || '').trim();
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;

  const rawBody = typeof req.rawBody === 'string'
    ? req.rawBody
    : JSON.stringify(req.body || {});

  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  const actual = Buffer.from(signature, 'utf8');
  const target = Buffer.from(expected, 'utf8');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
};

const getWhatsAppWebhookPayloadShape = (payload = {}) => {
  const shape = {
    isWhatsAppObject: payload?.object === 'whatsapp_business_account',
    hasMessagesField: false,
    hasStatuses: false,
    hasWamid: false
  };
  if (!shape.isWhatsAppObject || !Array.isArray(payload?.entry)) return shape;

  for (const entry of payload.entry) {
    for (const change of entry?.changes || []) {
      if (change?.field !== 'messages') continue;
      shape.hasMessagesField = true;
      const value = change?.value || {};
      const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      if (statuses.length > 0) shape.hasStatuses = true;
      if ([...statuses, ...messages].some((row) => String(row?.id || row?.message_id || '').startsWith('wamid.'))) {
        shape.hasWamid = true;
      }
    }
  }

  return shape;
};

const canTemporarilyBypassSignature = (payload = {}) => {
  const shape = getWhatsAppWebhookPayloadShape(payload);
  if (shape.hasStatuses) return true;
  return process.env.NODE_ENV === 'production' && shape.isWhatsAppObject && shape.hasMessagesField && shape.hasWamid;
};

const normalizeStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'PENDING_REVIEW' || normalized === 'IN_REVIEW' ? 'PENDING' : normalized;
};

const quotePostgrestValue = (value) => {
  const clean = String(value || '').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${clean}"`;
};

const isMissingStatusMatchColumn = (error) => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const normalizeDeliveryStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  return ['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(normalized) ? normalized : '';
};

const getDeliveryStatusRank = (status) => ({
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4
}[String(status || '').trim().toUpperCase()] || 0);

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
          const deliveryStatus = normalizeDeliveryStatus(rawStatus);

          return {
            status: rawStatus,
            deliveryStatus,
            userId: metadata.user_id || metadata.doctor_id || value.user_id || null,
            messageId: statusRow.id || statusRow.message_id || null,
            templateCategory: pricing.category || metadata.template_category || metadata.category || template.category || null,
            templateName: metadata.template_name || template.name || null,
            templateId: metadata.template_id || template.id || conversation.id || null,
            reason: statusRow.errors?.[0]?.title || statusRow.errors?.[0]?.message || 'Delivery Failed / Undelivered Number',
            timestamp: statusRow.timestamp || null,
            recipientPhone: String(statusRow.recipient_id || '').replace(/\D/g, ''),
            businessAccountId: metadata.whatsapp_business_account_id || metadata.waba_id || entry.id || null,
            phoneNumberId: metadata.phone_number_id || null,
            displayPhoneNumber: metadata.display_phone_number || null,
            error: statusRow.errors?.[0] || null,
            raw: statusRow
          };
        }).filter((update) => update.deliveryStatus && update.messageId);
      })
      : []
  ));
};

const updateInboxMessagesByWamid = async (db, update) => {
  const incomingWamid = String(update.messageId || '').trim();
  const quotedWamid = quotePostgrestValue(incomingWamid);
  const patch = { status: update.deliveryStatus };

  const runStatusUpdate = async (buildQuery) => {
    let query = buildQuery(db.from('inbox_messages').update(patch));
    const statusRank = getDeliveryStatusRank(update.deliveryStatus);
    if (statusRank <= getDeliveryStatusRank('SENT')) query = query.not('status', 'in', '("DELIVERED","READ","FAILED")');
    if (statusRank === getDeliveryStatusRank('DELIVERED')) query = query.not('status', 'in', '("READ","FAILED")');
    if (statusRank === getDeliveryStatusRank('READ')) query = query.neq('status', 'FAILED');
    return query.select('id, chat_id, metadata');
  };

  const attempts = [
    () => runStatusUpdate((query) => query.or(`meta_message_id.ilike.${quotedWamid},message_id.ilike.${quotedWamid}`)),
    () => runStatusUpdate((query) => query.filter('metadata->>meta_message_id', 'eq', incomingWamid)),
    () => runStatusUpdate((query) => query.filter('metadata->>message_id', 'eq', incomingWamid)),
    () => runStatusUpdate((query) => query.filter('metadata->>wamid', 'eq', incomingWamid)),
    () => runStatusUpdate((query) => query.ilike('wamid', incomingWamid))
  ];

  let result = { data: [], error: null };
  for (const attempt of attempts) {
    result = await attempt();
    if (result.error) {
      if (isMissingStatusMatchColumn(result.error)) continue;
      return result;
    }
    if (Array.isArray(result.data) && result.data.length > 0) return result;
  }

  return result;
};

const logWhatsAppWebhookStatusEvent = async (db, update, messages = [], processingError = null) => {
  if (!db?.from || !update?.messageId) return;
  try {
    const matchedMessages = Array.isArray(messages) ? messages : [];
    const { error } = await db.from('whatsapp_webhook_events').insert([{
      source: 'route_whatsapp_webhook',
      message_id: update.messageId,
      status: update.deliveryStatus,
      recipient_phone: update.recipientPhone || null,
      business_account_id: update.businessAccountId || null,
      phone_number_id: update.phoneNumberId || null,
      display_phone_number: update.displayPhoneNumber || null,
      matched_message_count: matchedMessages.length,
      matched_chat_ids: matchedMessages.map((message) => message.chat_id).filter(Boolean),
      processing_error: processingError ? String(processingError.message || processingError) : null,
      payload: update.raw || null
    }]);
    if (error && !isMissingStatusMatchColumn(error)) {
      console.error('WhatsApp webhook status event log failed:', error.message || error);
    }
  } catch (error) {
    console.error('WhatsApp webhook status event log crashed:', error.message || error);
  }
};

const syncInboxDeliveryStatus = async (db, update) => {
  const { data: messages, error } = await updateInboxMessagesByWamid(db, update);
  await logWhatsAppWebhookStatusEvent(db, update, messages || [], error || null);
  if (error) {
    console.error('Webhook inbox delivery status update failed:', error.message || error);
    return;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    console.warn('Webhook inbox delivery status matched no rows:', {
      messageId: update.messageId,
      status: update.deliveryStatus
    });
    return;
  }

  for (const message of messages) {
    const metadata = {
      ...(message.metadata || {}),
      meta_message_id: update.messageId,
      message_id: update.messageId,
      delivery_status: update.deliveryStatus,
      delivery_status_at: update.timestamp,
      delivery_error: update.error,
      whatsapp_business_account_id: update.businessAccountId || message.metadata?.whatsapp_business_account_id || null,
      whatsapp_phone_number_id: update.phoneNumberId || message.metadata?.whatsapp_phone_number_id || null,
      display_phone_number: update.displayPhoneNumber || message.metadata?.display_phone_number || null,
      last_meta_status: update.raw
    };

    const { error: messageError } = await db
      .from('inbox_messages')
      .update({ status: update.deliveryStatus, metadata })
      .eq('id', message.id);

    if (messageError) console.error('Webhook inbox metadata update failed:', messageError.message || messageError);

    if (!message.chat_id) continue;

    const { data: chat } = await db.from('inbox_chats').select('metadata').eq('id', message.chat_id).maybeSingle();
    const chatMetadata = chat?.metadata || {};
    const chatPatch = {
      status: update.deliveryStatus,
      updated_at: new Date().toISOString(),
      metadata: {
        ...chatMetadata,
        meta_message_id: update.messageId,
        delivery_status: update.deliveryStatus,
        whatsapp_business_account_id: update.businessAccountId || chatMetadata.whatsapp_business_account_id || null,
        subscription_status: 'ACTIVE',
        last_template: {
          ...(chatMetadata.last_template || {}),
          meta_message_id: update.messageId,
          message_id: update.messageId,
          delivery_status: update.deliveryStatus,
          delivery_status_at: update.timestamp,
          whatsapp_business_account_id: update.businessAccountId || chatMetadata.last_template?.whatsapp_business_account_id || null
        }
      }
    };
    if (update.deliveryStatus === 'READ') chatPatch.unread_count = 0;

    const { error: chatError } = await db
      .from('inbox_chats')
      .update(chatPatch)
      .eq('id', message.chat_id);

    if (chatError) console.error('Webhook inbox chat status update failed:', chatError.message || chatError);
  }
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
  console.log("Incoming Webhook Payload:", JSON.stringify(req.body));

  res.status(200).send('EVENT_RECEIVED');

  if (!verifySignature(req)) {
    console.warn('WhatsApp routed webhook signature rejected after ACK; payload will not be processed.', {
      hasAppSecret: Boolean(getAppSecret()),
      hasSignature: Boolean(String(req.get('x-hub-signature-256') || '').trim()),
      hasRawBody: typeof req.rawBody === 'string' && req.rawBody.length > 0
    });
    return;
  }

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
      await syncInboxDeliveryStatus(db, update);

      if (update.deliveryStatus === 'FAILED') {
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
    }
  } catch (error) {
    console.error('Webhook handler error:', error.message || error);
  }
};
