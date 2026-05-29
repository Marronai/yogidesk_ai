import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const normalizePhone = (value = '') => String(value).replace(/[^\d]/g, '');

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
  };
};

serve(async (req) => {
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
    const { fromPhone, clinicMetaId, messageText, patientName, currentAdminId } = extractMessage(payload);

    if (!fromPhone || !messageText) return json({ ok: true, skipped: true });

    const { data: existingPatient } = await supabase
      .from('patients_ledger')
      .select('id')
      .eq('phone', fromPhone)
      .maybeSingle();

    if (!existingPatient) {
      await supabase.from('patients_ledger').insert([{
        user_id: currentAdminId,
        name: patientName,
        phone: fromPhone,
        appointment_time: null,
      }]);
    }

    let chatId = null;
    const { data: existingChat } = await supabase
      .from('inbox_chats')
      .select('id, unread_count, metadata')
      .eq('phone', fromPhone)
      .maybeSingle();

    if (existingChat?.id) {
      chatId = existingChat.id;
      const existingMetadata = existingChat.metadata || {};
      await supabase
        .from('inbox_chats')
        .update({
          user_id: currentAdminId,
          doctor_id: currentAdminId,
          name: patientName,
          patient_name: patientName,
          patient_phone: fromPhone,
          last_message: messageText,
          status: 'Active',
          unread_count: Number(existingChat.unread_count || 0) + 1,
          updated_at: new Date().toISOString(),
          metadata: {
            ...existingMetadata,
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
          user_id: currentAdminId,
          doctor_id: currentAdminId,
          name: patientName,
          patient_name: patientName,
          phone: fromPhone,
          patient_phone: fromPhone,
          last_message: messageText,
          status: 'Active',
          unread_count: 1,
          updated_at: new Date().toISOString(),
          metadata: {
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
      workspace_id: currentAdminId,
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
      metadata: { inbound: true },
    }]);

    return json({ ok: true });
  } catch (error) {
    console.error('whatsapp-webhook error:', error);
    return json({ ok: true, accepted: true });
  }
});
