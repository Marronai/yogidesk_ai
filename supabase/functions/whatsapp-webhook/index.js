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
    const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && token && token === verifyToken) return new Response(challenge || '', { status: 200 });
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

    await supabase.from('inbox_messages').insert([{
      workspace_id: currentAdminId,
      sender_phone: fromPhone,
      receiver_phone: clinicMetaId,
      message_body: messageText,
      is_private_note: false,
    }]);

    return json({ ok: true });
  } catch (error) {
    console.error('whatsapp-webhook error:', error);
    return json({ ok: true, accepted: true });
  }
});
