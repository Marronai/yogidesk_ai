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
const getPhoneMatchParts = (value = '') => {
  const digits = normalizePhone(value);
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const variants = new Set([digits]);
  if (last10 && last10.length === 10) {
    variants.add(last10);
    variants.add(`91${last10}`);
  }
  return {
    digits,
    last10,
    variants: Array.from(variants).filter(Boolean),
  };
};
const buildPhoneOrFilter = (columns = [], value = '') => {
  const { last10, variants } = getPhoneMatchParts(value);
  const filters = [];
  for (const column of columns) {
    for (const variant of variants) filters.push(`${column}.eq.${variant}`);
    if (last10 && last10.length === 10) filters.push(`${column}.ilike.%${last10}`);
  }
  return filters.join(',');
};
const normalizeDeliveryStatus = (value = '') => {
  const status = String(value || '').trim().toUpperCase();
  return ['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(status) ? status : '';
};

const extractStatuses = (payload) => {
  const updates = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (change?.field !== 'messages') continue;
      const value = change?.value || {};
      for (const row of value?.statuses || []) {
        const messageId = row?.id || row?.message_id || '';
        const status = normalizeDeliveryStatus(row?.status);
        if (!messageId || !status) continue;
        updates.push({
          messageId,
          status,
          timestamp: row?.timestamp || null,
          recipientPhone: normalizePhone(row?.recipient_id || ''),
          error: row?.errors?.[0] || null,
          raw: row,
        });
      }
    }
  }
  return updates;
};

const updateDeliveryStatus = async (update) => {
  let { data: messages, error } = await supabase
    .from('inbox_messages')
    .select('id, chat_id, metadata')
    .eq('metadata->>meta_message_id', update.messageId)
    .limit(10);

  if (error || !messages?.length) {
    const fallback = await supabase
      .from('inbox_messages')
      .select('id, chat_id, metadata')
      .eq('metadata->>message_id', update.messageId)
      .limit(10);
    messages = fallback.data || [];
    error = fallback.error;
  }

  if ((!messages || messages.length === 0) && update.recipientPhone) {
    const receiverPhoneFilter = buildPhoneOrFilter(['receiver_phone'], update.recipientPhone);
    const fallbackByPhone = await supabase
      .from('inbox_messages')
      .select('id, chat_id, metadata')
      .or(receiverPhoneFilter)
      .eq('from_me', true)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!fallbackByPhone.error) messages = fallbackByPhone.data || [];
  }

  if ((!messages || messages.length === 0) && update.recipientPhone) {
    const chatPhoneFilter = buildPhoneOrFilter(['phone', 'patient_phone'], update.recipientPhone);
    const { data: chat } = await supabase
      .from('inbox_chats')
      .select('id')
      .or(chatPhoneFilter)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chat?.id) {
      const fallbackByChat = await supabase
        .from('inbox_messages')
        .select('id, chat_id, metadata')
        .eq('chat_id', chat.id)
        .eq('from_me', true)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!fallbackByChat.error) messages = fallbackByChat.data || [];
    }
  }

  if (error) {
    console.error('delivery status lookup failed:', error);
    return;
  }

  for (const message of messages || []) {
    const metadata = {
      ...(message.metadata || {}),
      delivery_status: update.status,
      delivery_status_at: update.timestamp,
      delivery_error: update.error,
      last_meta_status: update.raw,
    };

    await supabase
      .from('inbox_messages')
      .update({ status: update.status, metadata })
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
          }
        : chatMetadata.last_template;

      await supabase
        .from('inbox_chats')
        .update({
          status: update.status,
          metadata: {
            ...chatMetadata,
            meta_message_id: update.messageId,
            delivery_status: update.status,
            subscription_status: 'ACTIVE',
            ...(lastTemplate ? { last_template: lastTemplate } : {}),
          },
        })
        .eq('id', message.chat_id);
    }
  }
};

const resolveWorkspaceId = async (clinicMetaId, fallbackId, patientPhone) => {
  if (fallbackId) return fallbackId;

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
  const value = payload?.entry?.[0]?.changes?.[0]?.value || {};
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];
  const metadata = value?.metadata || {};
  const fromPhone = normalizePhone(message?.from || contact?.wa_id);
  const clinicMetaId = normalizePhone(metadata?.phone_number_id || metadata?.display_phone_number);
  const text = message?.text?.body || message?.button?.text || message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || '';

  return {
    fromPhone,
    clinicMetaId,
    messageText: String(text).trim(),
    patientName: contact?.profile?.name || 'WhatsApp Patient',
    currentAdminId: metadata?.workspace_id || metadata?.admin_id || Deno.env.get('DEFAULT_WORKSPACE_ID') || null,
    messageId: message?.id || null,
  };
};

const processWebhookPayload = async (payload) => {
  const statuses = extractStatuses(payload);
  for (const status of statuses) await updateDeliveryStatus(status);

  const { fromPhone, clinicMetaId, messageText, patientName, currentAdminId, messageId } = extractMessage(payload);

  if (!fromPhone || !messageText) return;

  const workspaceId = await resolveWorkspaceId(clinicMetaId, currentAdminId, fromPhone);
  if (!workspaceId) return;

  const { data: existingPatient } = await supabase
    .from('patients_ledger')
    .select('id')
    .eq('phone', fromPhone)
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
    metadata: { inbound: true, meta_message_id: messageId },
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
    const processing = req.clone().json()
      .then(processWebhookPayload)
      .catch((error) => console.error('whatsapp-webhook error:', error));
    if (globalThis.EdgeRuntime?.waitUntil) {
      globalThis.EdgeRuntime.waitUntil(processing);
    } else {
      // processing already owns its error handler; this branch keeps Deno happy outside EdgeRuntime.
    }
    return new Response('EVENT_RECEIVED', {
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
