import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const normalizePhone = (value = '') => String(value).replace(/[^\d]/g, '');
const normalizeMetaId = (value = '') => String(value || '').trim().replace(/[^\w.-]/g, '');
const getPhoneMatchParts = (value = '') => {
  const digits = normalizePhone(value);
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const strippedCountryVariants = new Set([digits]);
  if (digits.length === 12 && digits.startsWith('91')) strippedCountryVariants.add(digits.slice(2));
  if (digits.length === 11 && digits.startsWith('1')) strippedCountryVariants.add(digits.slice(1));

  const variants = new Set();
  for (const variant of strippedCountryVariants) {
    if (!variant) continue;
    variants.add(variant);
    variants.add(`+${variant}`);
  }
  if (last10 && last10.length === 10) {
    variants.add(last10);
    variants.add(`+${last10}`);
    variants.add(`91${last10}`);
    variants.add(`+91${last10}`);
    variants.add(`1${last10}`);
    variants.add(`+1${last10}`);
  }
  const suffixes = new Set();
  for (const size of [12, 11, 10]) {
    if (digits.length >= size) suffixes.add(digits.slice(-size));
  }
  if (last10 && last10.length === 10) suffixes.add(last10);

  return {
    digits,
    last10,
    variants: Array.from(variants).filter(Boolean),
    suffixes: Array.from(suffixes).filter(Boolean),
  };
};
const buildPhoneOrFilter = (columns = [], value = '') => {
  const { suffixes, variants } = getPhoneMatchParts(value);
  const filters = [];
  for (const column of columns) {
    for (const variant of variants) filters.push(`${column}.eq.${variant}`);
    for (const suffix of suffixes) filters.push(`${column}.ilike.%${suffix}`);
  }
  return filters.join(',');
};
const normalizeDeliveryStatus = (value = '') => {
  const status = String(value || '').trim().toUpperCase();
  return ['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status) ? status : '';
};
const quotePostgrestValue = (value = '') => {
  const clean = String(value || '').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${clean}"`;
};
const isMissingStatusMatchColumn = (error) => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const extractStatuses = (payload) => {
  try {
    const updates = [];
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        if (change?.field !== 'messages') continue;
        const value = change?.value || {};
        const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
        const metadata = value?.metadata || {};

        for (const statusObj of statuses) {
          const incomingWamid = String(statusObj?.id || statusObj?.message_id || '').trim();
          const rawStatus = normalizeDeliveryStatus(String(statusObj?.status || '').trim().toUpperCase());
          if (!incomingWamid || !rawStatus) continue;

          updates.push({
            messageId: incomingWamid,
            status: rawStatus,
            timestamp: statusObj?.timestamp || null,
            recipientPhone: normalizePhone(statusObj?.recipient_id || ''),
            businessAccountId: normalizeMetaId(metadata?.whatsapp_business_account_id || metadata?.waba_id || entry?.id || ''),
            phoneNumberId: normalizeMetaId(metadata?.phone_number_id || ''),
            displayPhoneNumber: normalizePhone(metadata?.display_phone_number || ''),
            error: statusObj?.errors?.[0] || null,
            raw: statusObj,
          });
        }
      }
    }
    return updates;
  } catch (error) {
    console.error('WhatsApp status payload extraction failed:', error?.message || error);
    return [];
  }
};

const updateDeliveryStatus = async (update) => {
  const patch = { status: update.status };
  const incomingWamid = String(update.messageId || '').trim();
  const quotedWamid = quotePostgrestValue(incomingWamid);
  console.log('Processing Webhook for WAMID:', incomingWamid, 'New Status:', update.status);

  const runStatusUpdate = async (buildQuery) => {
    let query = buildQuery(supabase.from('inbox_messages').update(patch));
    if (update.status !== 'READ') query = query.neq('status', 'READ');
    return query.select('id, chat_id, metadata');
  };

  const attempts = [
    () => runStatusUpdate((query) => query.or(`meta_message_id.ilike.${quotedWamid},message_id.ilike.${quotedWamid}`)),
    () => runStatusUpdate((query) => query.filter('metadata->>meta_message_id', 'eq', incomingWamid)),
    () => runStatusUpdate((query) => query.filter('metadata->>message_id', 'eq', incomingWamid)),
    () => runStatusUpdate((query) => query.filter('metadata->>wamid', 'eq', incomingWamid)),
    () => runStatusUpdate((query) => query.ilike('wamid', incomingWamid)),
  ];

  let messages = [];
  let error = null;
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.error) {
      if (isMissingStatusMatchColumn(result.error)) {
        continue;
      }
      error = result.error;
      break;
    }
    error = null;
    messages = result.data || [];
    if (messages.length > 0) break;
  }

  if (error) {
    console.error('delivery status WAMID update failed:', error);
    return;
  }

  if (!messages.length) {
    console.warn('delivery status update matched no WAMID rows after all lookup strategies:', {
      incomingWamid,
      status: update.status,
    });
  }

  for (const message of messages || []) {
    const metadata = {
      ...(message.metadata || {}),
      meta_message_id: update.messageId,
      message_id: update.messageId,
      delivery_status: update.status,
      delivery_status_at: update.timestamp,
      delivery_error: update.error,
      whatsapp_business_account_id: update.businessAccountId || message.metadata?.whatsapp_business_account_id || null,
      whatsapp_phone_number_id: update.phoneNumberId || message.metadata?.whatsapp_phone_number_id || null,
      display_phone_number: update.displayPhoneNumber || message.metadata?.display_phone_number || null,
      last_meta_status: update.raw,
    };

    await supabase
      .from('inbox_messages')
      .update({
        status: update.status,
        metadata,
      })
      .eq('id', message.id);

    if (message.chat_id) {
      const { data: chat } = await supabase
        .from('inbox_chats')
        .select('metadata')
        .eq('id', message.chat_id)
        .maybeSingle();
      const chatMetadata = chat?.metadata || {};
      const lastTemplate = chatMetadata.last_template
        ? {
            ...chatMetadata.last_template,
            meta_message_id: update.messageId,
            message_id: update.messageId,
            delivery_status: update.status,
            delivery_status_at: update.timestamp,
            delivery_error: update.error,
            whatsapp_business_account_id: update.businessAccountId || chatMetadata.last_template?.whatsapp_business_account_id || null,
          }
        : chatMetadata.last_template;

      await supabase
        .from('inbox_chats')
        .update({
          status: update.status,
          updated_at: new Date().toISOString(),
          metadata: {
            ...chatMetadata,
            meta_message_id: update.messageId,
            delivery_status: update.status,
            whatsapp_business_account_id: update.businessAccountId || chatMetadata.whatsapp_business_account_id || null,
            subscription_status: 'ACTIVE',
            ...(lastTemplate ? { last_template: lastTemplate } : {}),
          },
        })
        .eq('id', message.chat_id);
    }
  }
};

const resolveWorkspaceId = async (clinicMetaId, fallbackId, patientPhone, businessAccountId) => {
  if (fallbackId) return fallbackId;

  if (businessAccountId) {
    const { data } = await supabase
      .from('doctor_profiles')
      .select('id')
      .or(`meta_waba_id.eq.${businessAccountId},whatsapp_business_account_id.eq.${businessAccountId}`)
      .limit(1)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  if (clinicMetaId) {
    const { data } = await supabase
      .from('doctor_profiles')
      .select('id')
      .or(`meta_phone_number_id.eq.${clinicMetaId},whatsapp_phone_number_id.eq.${clinicMetaId}`)
      .limit(1)
      .maybeSingle();

    if (data?.id) return data.id;
  }

  if (patientPhone) {
    const phoneFilter = buildPhoneOrFilter(['phone', 'patient_phone'], patientPhone);
    const { data } = await supabase
      .from('inbox_chats')
      .select('user_id, doctor_id')
      .or(phoneFilter)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return data?.user_id || data?.doctor_id || null;
  }

  return null;
};

const extractMessage = (payload) => {
  const entry = payload?.entry?.[0] || {};
  const value = entry?.changes?.[0]?.value || {};
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  const metadata = value?.metadata || {};
  const fromPhone = normalizePhone(message?.from || contact?.wa_id);
  const clinicMetaId = normalizePhone(metadata?.phone_number_id || metadata?.display_phone_number);
  const businessAccountId = normalizeMetaId(metadata?.whatsapp_business_account_id || metadata?.waba_id || entry?.id || '');
  const text = message?.text?.body || message?.button?.text || message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || '';

  return {
    fromPhone,
    clinicMetaId,
    businessAccountId,
    phoneNumberId: normalizeMetaId(metadata?.phone_number_id || ''),
    displayPhoneNumber: normalizePhone(metadata?.display_phone_number || ''),
    messageText: String(text).trim(),
    patientName: contact?.profile?.name || 'WhatsApp Patient',
    currentAdminId: metadata?.workspace_id || metadata?.admin_id || Deno.env.get('DEFAULT_WORKSPACE_ID') || null,
    messageId: message?.id || null,
  };
};

const processWebhookPayload = async (payload, preExtractedStatuses = null) => {
  const statuses = Array.isArray(preExtractedStatuses) ? preExtractedStatuses : extractStatuses(payload);
  for (const status of statuses) await updateDeliveryStatus(status);

  const { fromPhone, clinicMetaId, businessAccountId, phoneNumberId, displayPhoneNumber, messageText, patientName, currentAdminId, messageId } = extractMessage(payload);

  if (!fromPhone || !messageText) return;

  const workspaceId = await resolveWorkspaceId(clinicMetaId, currentAdminId, fromPhone, businessAccountId);
  if (!workspaceId) return;

  const patientPhoneFilter = buildPhoneOrFilter(['phone'], fromPhone);
  const { data: existingPatient } = await supabase
    .from('patients_ledger')
    .select('id')
    .or(patientPhoneFilter)
    .limit(1)
    .maybeSingle();

  if (!existingPatient) {
    await supabase.from('patients_ledger').insert([{
      user_id: workspaceId,
      name: patientName,
      phone: fromPhone,
      appointment_time: null,
    }]);
  }

  let chatId = null;
  const phoneFilter = buildPhoneOrFilter(['phone', 'patient_phone'], fromPhone);
  const { data: existingChat } = await supabase
    .from('inbox_chats')
    .select('id, unread_count, metadata')
    .or(phoneFilter)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingChat?.id) {
    chatId = existingChat.id;
    const existingMetadata = existingChat.metadata || {};
    await supabase
      .from('inbox_chats')
      .update({
        user_id: workspaceId,
        doctor_id: workspaceId,
        name: patientName,
        patient_name: patientName,
        patient_phone: fromPhone,
        last_message: messageText,
        status: 'Active',
        unread_count: Number(existingChat.unread_count || 0) + 1,
        updated_at: new Date().toISOString(),
        metadata: {
          ...existingMetadata,
          meta_message_id: messageId,
          whatsapp_business_account_id: businessAccountId || existingMetadata.whatsapp_business_account_id || null,
          whatsapp_phone_number_id: phoneNumberId || existingMetadata.whatsapp_phone_number_id || null,
          display_phone_number: displayPhoneNumber || existingMetadata.display_phone_number || null,
          subscription_status: 'ACTIVE',
          last_customer_message_at: new Date().toISOString(),
          last_inbound_at: new Date().toISOString(),
          whatsapp_window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      })
      .eq('id', chatId);
  } else {
    const { data: createdChat } = await supabase
      .from('inbox_chats')
      .insert([{
        user_id: workspaceId,
        doctor_id: workspaceId,
        name: patientName,
        patient_name: patientName,
        phone: fromPhone,
        patient_phone: fromPhone,
        last_message: messageText,
        status: 'Active',
        unread_count: 1,
        updated_at: new Date().toISOString(),
        metadata: {
          meta_message_id: messageId,
          whatsapp_business_account_id: businessAccountId || null,
          whatsapp_phone_number_id: phoneNumberId || null,
          display_phone_number: displayPhoneNumber || null,
          subscription_status: 'ACTIVE',
          last_customer_message_at: new Date().toISOString(),
          last_inbound_at: new Date().toISOString(),
          whatsapp_window_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      }])
      .select('id')
      .maybeSingle();
    chatId = createdChat?.id || null;
  }

  await supabase.from('inbox_messages').insert([{
    chat_id: chatId,
    workspace_id: workspaceId,
    sender_phone: fromPhone,
    receiver_phone: clinicMetaId,
    sender: 'user',
    from_me: false,
    type: 'public',
    message_type: 'text',
    status: 'RECEIVED',
    body: messageText,
    text: messageText,
    message_text: messageText,
    message_body: messageText,
    is_private_note: false,
    metadata: {
      inbound: true,
      meta_message_id: messageId,
      whatsapp_business_account_id: businessAccountId || null,
      whatsapp_phone_number_id: phoneNumberId || null,
      display_phone_number: displayPhoneNumber || null,
    },
  }]);
};

serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === 'YogiDesk_Doctor_Secure_2026') return new Response(challenge || '', { status: 200 });
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  try {
    const payload = await req.json();
    const statuses = extractStatuses(payload);
    console.log('WhatsApp Edge webhook POST hit:', {
      object: payload?.object || null,
      entryCount: Array.isArray(payload?.entry) ? payload.entry.length : 0,
      statusCount: statuses.length,
    });
    const processing = processWebhookPayload(payload, statuses)
      .catch((error) => console.error('whatsapp-webhook error:', error));
    if (globalThis.EdgeRuntime?.waitUntil) {
      globalThis.EdgeRuntime.waitUntil(processing);
    } else {
      // processing already owns its error handler; this branch keeps Deno happy outside EdgeRuntime.
    }
    return new Response(statuses.length > 0 ? 'EVENT_RECEIVED' : 'NO_STATUS_PAYLOAD', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('whatsapp-webhook error:', error);
    return new Response('EVENT_RECEIVED', {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }
});
