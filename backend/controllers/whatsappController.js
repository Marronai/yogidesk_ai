require('dotenv').config();
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const uniqueValues = (values) => Array.from(new Set(values.filter(Boolean)));

const axios = require('axios');
const { supabase, supabaseAdmin } = require('../config/supabase');

const missingSubAccountConfigResponse = {
    success: false,
    message: "WhatsApp API profile configuration missing for this sub-account."
};
const META_CONFIGURATION_LOCKED_MESSAGE = "Configuration locked. Contact Customer Support to modify your Meta integrations.";

const shouldBypassCampaignWalletCheck = () => (
    process.env.NODE_ENV === 'development' ||
    process.env.BYPASS_CAMPAIGN_WALLET_CHECK === 'true' ||
    process.env.YOGIDESK_TEST_WALLET_BYPASS === 'true'
);

const isSchemaCacheError = (error) => {
    const message = String(error?.message || error?.details || error || '').toLowerCase();
    return (
        error?.code === 'PGRST204' ||
        message.includes('schema cache') ||
        message.includes('could not find') ||
        message.includes('column') ||
        message.includes('relationship')
    );
};

const getMissingSchemaColumn = (error) => {
    const text = String(error?.message || error?.details || error || '');
    const quotedMatch = text.match(/'([^']+)'\s+column/i);
    if (quotedMatch?.[1]) return quotedMatch[1];

    const doubleQuotedMatch = text.match(/column\s+"([^"]+)"/i);
    if (doubleQuotedMatch?.[1]) return doubleQuotedMatch[1];

    const cacheMatch = text.match(/schema cache.*?['"]([^'"]+)['"]/i);
    if (cacheMatch?.[1]) return cacheMatch[1];

    return '';
};

const insertInboxMessageWithSchemaFallback = async (row = {}, dbClient = supabase) => {
    const stableMetadata = {
        ...(row.metadata || {}),
        ...(row.message_id ? { message_id: row.message_id } : {}),
        ...(row.meta_message_id ? { meta_message_id: row.meta_message_id } : {})
    };
    let payload = { ...row, metadata: stableMetadata };
    const removedColumns = new Set();

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const { error } = await dbClient.from('inbox_messages').insert(payload);
        if (!error) return { success: true };

        const missingColumn = getMissingSchemaColumn(error);
        if (isSchemaCacheError(error) && missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn) && !removedColumns.has(missingColumn)) {
            console.warn(`Inbox message insert retrying without stale schema column: ${missingColumn}`);
            removedColumns.add(missingColumn);
            const { [missingColumn]: _removed, ...nextPayload } = payload;
            payload = nextPayload;
            continue;
        }

        if (isSchemaCacheError(error) && attempt === 0) {
            console.warn('Inbox message insert retrying without top-level WAMID columns due to schema cache mismatch.', {
                code: error.code,
                message: error.message
            });
            const { message_id: _messageId, meta_message_id: _metaMessageId, ...nextPayload } = payload;
            payload = nextPayload;
            continue;
        }

        return { success: false, error };
    }

    return { success: false };
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
const phoneDigitsOnly = (value) => String(value || '').replace(/\D/g, '');
const removeUndefinedValues = (value = {}) => Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
);
const GEMINI_BOUNCE_WINDOW_MS = 4000;
const GEMINI_RESULT_CACHE_MS = 30000;
const GEMINI_429_RETRY_DELAY_MS = 10000;
const GEMINI_HISTORY_WINDOW_DAYS = 5;
const GEMINI_HISTORY_MESSAGE_LIMIT = 20;
const geminiProcessingCache = new Map();
const geminiResultCache = new Map();
const geminiPatientDebounceQueue = new Map();
const GEMINI_MODEL_NAME = 'gemini-3.1-flash-lite';
const GEMINI_REPORT_ESCALATION_REPLY = 'Main aapka appointment Dr. Sahab ke sath book kar deti hoon, wo live aapki reports check karke aapko sahi aur sateek salah denge. Kya main aapka slot confirm karoon?';
const BASELINE_GEMINI_SYSTEM_INSTRUCTION = [
    'You are a polite, empathetic, professional female Clinic Desk Receptionist and Patient Care Assistant.',
    'You are a polite, professional, and empathetic clinical receptionist chatbot. To make text interactive and comforting for patients, naturally integrate appropriate, clean healthcare emojis across conversational milestones.',
    'Emoji Style: Use 🩺 or 👨‍⚕️ when mentioning doctors/consultations, 📅 or ⏰ for appointments/timings, 📍 for clinic locations, 💰 for consultation fees, and ✅ for successful confirmation cards. Keep sentences structured, concise, and beautifully humanized.',
    'Use natural, warm, comforting conversational Hinglish like a real human coordinator.',
    'Handle patient inquiries, doctor availability, clinic details, and appointment coordination only.',
    'Never provide official prescriptions, independent diagnosis, lab-report conclusions, or treatment decisions.'
].join('\n');

const getNextGeminiModel = () => {
    const apiKey = String(process.env.GEMINI_3_1_FLASH_LITE_KEY || '').trim();
    if (!apiKey) throw new Error('Gemini API key missing. Set GEMINI_3_1_FLASH_LITE_KEY.');
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        systemInstruction: BASELINE_GEMINI_SYSTEM_INSTRUCTION
    });
};

const isGeminiRateLimitError = (error) => {
    const status = Number(error?.status || error?.statusCode || error?.response?.status || error?.error?.code);
    const text = JSON.stringify(error?.response?.data || error?.error || error?.message || error || '').toLowerCase();
    return status === 429 || text.includes('429') || text.includes('too many requests') || text.includes('quota');
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MIN_HUMAN_REPLY_DELAY_MS = 30000;
const MAX_HUMAN_REPLY_DELAY_MS = 60000;

const calculateHumanReplyDelayMs = (text = '') => {
    const textLength = String(text || '').trim().length;
    const estimatedDelay = MIN_HUMAN_REPLY_DELAY_MS + (textLength * 80);
    return Math.min(MAX_HUMAN_REPLY_DELAY_MS, Math.max(MIN_HUMAN_REPLY_DELAY_MS, estimatedDelay));
};

const generateGeminiContentWithRetry = async (prompt) => {
    try {
        return await getNextGeminiModel().generateContent(prompt);
    } catch (error) {
        if (!isGeminiRateLimitError(error)) throw error;
        console.warn('[YogiDesk Secure AI] Gemini model rate-limited; queueing delayed retry on the configured production key.');
        await wait(GEMINI_429_RETRY_DELAY_MS);
        return getNextGeminiModel().generateContent(prompt);
    }
};

const sanitizeGeminiContextValue = (value, fallback, maxLength = 1200) => {
    const cleaned = String(value || '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength);
    return cleaned || fallback;
};

const fetchClinicKnowledgeBaseForDoctor = async (doctorId) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !doctorId) return null;

    try {
        const { data, error } = await db
            .from('clinic_knowledge_base')
            .select('clinic_timing, services_offered, clinic_location, consultation_fees')
            .eq('doctor_id', doctorId)
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.error('[YogiDesk Secure AI] Knowledge base lookup bypassed');
            return null;
        }

        return data || null;
    } catch {
        console.error('[YogiDesk Secure AI] Knowledge base lookup bypassed');
        return null;
    }
};

const buildGeminiSystemInstruction = (dbData = {}) => [
    'Identity: You are the official polite, empathetic, professional female Clinic Desk Receptionist and Patient Care Assistant for this clinic.',
    'Clinical Receptionist Style: You are a polite, professional, and empathetic clinical receptionist chatbot. To make text interactive and comforting for patients, naturally integrate appropriate, clean healthcare emojis across conversational milestones.',
    'Emoji Guidelines: Use 🩺 or 👨‍⚕️ when mentioning doctors/consultations, 📅 or ⏰ for appointments/timings, 📍 for clinic locations, 💰 for consultation fees, and ✅ for successful confirmation cards. Keep sentences structured, concise, and beautifully humanized.',
    'Tone & Language: Speak like a real warm human coordinator in natural comforting conversational Hinglish, mixing Hindi and English as patients normally do. Avoid cold robotic phrasing, stiff scripts, and overly technical medical jargon.',
    'Behavior Boundary: You only handle patient inquiries, doctor availability, clinic information, and appointment slot coordination. Never issue official prescriptions, independent diagnosis, lab-report conclusions, or treatment decisions.',
    'Here is the strict, verified ground-truth data for this specific doctor only. Do NOT invent, hallucinate, or use any outside knowledge:',
    `- Clinic Timings: ${sanitizeGeminiContextValue(dbData.clinic_timing, 'Contact clinic directly', 500)}`,
    `- Services Offered: ${sanitizeGeminiContextValue(dbData.services_offered, 'General Consultation', 1200)}`,
    `- Location/Address: ${sanitizeGeminiContextValue(dbData.clinic_location, 'Contact clinic directly', 1000)}`,
    `- Consultation Fees: ${sanitizeGeminiContextValue(dbData.consultation_fees, 'Contact clinic directly', 250)}`,
    '',
    'Rules:',
    '1. Answer the patient query politely and conversationally in their preferred language: Hindi, English, or conversational Hinglish.',
    '2. Keep the tone warm, reassuring, concise, human-like, and highly precise.',
    `3. If the patient asks about medical diagnostics, interpretations, or uploading laboratory reports, including phrases like "Mera report check karo" or "Is this report normal?", reply exactly: "${GEMINI_REPORT_ESCALATION_REPLY}" Never attempt to diagnose or interpret medical reports yourself under any condition.`,
    '4. If clinic-specific information is missing, say: "Kindly book an appointment to consult the doctor directly."',
    '5. Continue collecting Patient Name, Appointment Date, and Time naturally. When a patient explicitly confirms a preferred date and time slot for an appointment, you MUST automatically invoke the `bookPatientAppointment` function tool passing the patient\'s parsed credentials. If native tool calling is unavailable in this channel, append \'[CONFIRM_BOOKING: Name | Date | Time]\' at the end so the booking hook can execute securely.',
    `6. Appointment date rule: The absolute date for the appointment. You MUST dynamically compute this relative to today\'s date (Current Date: ${formatDateOnly(new Date())}) and output it strictly in \'YYYY-MM-DD\' format. Never pass relative text strings like \'tomorrow\', \'parso\', or \'The day after tomorrow\'.`,
    '7. Appointment time rule: The exact scheduled time slot for the appointment. You MUST dynamically parse relative spoken time expressions from the patient (e.g., \'2 PM\', \'3 baje dopehar ko\', \'4:30 pm\') and transform them strictly into 24-hour HH:MM format (e.g., \'14:00\', \'15:00\', \'16:30\'). Never pass \'PM\', \'AM\', or unformatted strings raw to the handler.',
    '8. Appointment status and slot validation rule: Do not infer appointment status, booked slots, or confirmations from chat history. Use only the direct appointment database lookup context supplied in this prompt, and if it is missing, ask the patient for the exact date/time or say the clinic desk will verify.'
].join('\n');

const buildGeminiDedupeKey = ({ messageId, fromPhone, text, phoneNumberId, businessAccountId, languageCode }) => {
    const normalizedPayload = JSON.stringify({
        messageId: String(messageId || '').trim(),
        fromPhone: phoneDigitsOnly(fromPhone),
        phoneNumberId: String(phoneNumberId || '').trim(),
        businessAccountId: String(businessAccountId || '').trim(),
        languageCode: String(languageCode || '').trim(),
        text: String(text || '').trim()
    });
    return crypto.createHash('sha256').update(normalizedPayload).digest('hex');
};

const pruneGeminiCaches = (now = Date.now()) => {
    for (const [key, entry] of geminiProcessingCache.entries()) {
        if (!entry?.startedAt || now - entry.startedAt > GEMINI_BOUNCE_WINDOW_MS) geminiProcessingCache.delete(key);
    }
    for (const [key, entry] of geminiResultCache.entries()) {
        if (!entry?.storedAt || now - entry.storedAt > GEMINI_RESULT_CACHE_MS) geminiResultCache.delete(key);
    }
};

const buildPatientPhoneNode = (inbound = {}) => [
    phoneDigitsOnly(inbound.fromPhone),
    String(inbound.phoneNumberId || '').trim(),
    String(inbound.businessAccountId || '').trim()
].filter(Boolean).join(':');

const formatDebouncedGeminiText = (messages = []) => messages
    .map((entry, index) => `[Text ${index + 1}] ${String(entry.text || '').trim()}`)
    .filter((line) => line.trim())
    .join('\n');

const debounceGeminiInbound = (inbound = {}) => new Promise((resolve) => {
    const patientPhoneNode = buildPatientPhoneNode(inbound);
    if (!patientPhoneNode) {
        resolve([inbound]);
        return;
    }

    const existing = geminiPatientDebounceQueue.get(patientPhoneNode);
    if (existing?.timer) clearTimeout(existing.timer);
    if (existing?.resolve) existing.resolve([]);

    const messages = [...(existing?.messages || []), inbound];
    const entry = {
        messages,
        resolve,
        timer: null,
        patientPhoneNode
    };

    entry.timer = setTimeout(() => {
        geminiPatientDebounceQueue.delete(patientPhoneNode);
        const latest = messages[messages.length - 1] || inbound;
        resolve([{
            ...latest,
            messageId: uniqueValues(messages.map((item) => item.messageId)).join('|') || latest.messageId,
            text: formatDebouncedGeminiText(messages) || latest.text,
            debounced: {
                patient_phone_node: patientPhoneNode,
                merged_message_count: messages.length,
                window_ms: GEMINI_BOUNCE_WINDOW_MS
            }
        }]);
    }, GEMINI_BOUNCE_WINDOW_MS);

    geminiPatientDebounceQueue.set(patientPhoneNode, entry);
});

const debounceGeminiInbounds = async (inboundMessages = []) => {
    const batches = await Promise.all(inboundMessages.map((inbound) => debounceGeminiInbound(inbound)));
    return batches.flat().filter(Boolean);
};
const getPhoneMatchParts = (value) => {
    const digits = phoneDigitsOnly(value);
    const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
    const variants = new Set([digits]);
    if (last10 && last10.length === 10) {
        variants.add(last10);
        variants.add(`91${last10}`);
        variants.add(`+91${last10}`);
        variants.add(`1${last10}`);
        variants.add(`+1${last10}`);
    }
    return { digits, last10, variants: Array.from(variants).filter(Boolean) };
};

const resolveMetaReplyCredentials = async ({ phoneNumberId, businessAccountId } = {}) => {
    const envPhoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_PHONE_ID || '').trim();
    const envAccessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || '').trim();
    const fallbackCredentials = {
        phoneNumberId: String(phoneNumberId || envPhoneNumberId || '').trim(),
        accessToken: envAccessToken
    };

    const db = supabaseAdmin || supabase;
    if (!db?.from) return fallbackCredentials;

    try {
        const filters = [];
        if (businessAccountId) filters.push(`meta_waba_id.eq.${businessAccountId}`, `whatsapp_business_account_id.eq.${businessAccountId}`);
        if (phoneNumberId) filters.push(`meta_phone_number_id.eq.${phoneNumberId}`, `whatsapp_phone_number_id.eq.${phoneNumberId}`);

        if (filters.length === 0) return fallbackCredentials;

        const { data, error } = await db
            .from('doctor_profiles')
            .select('meta_phone_number_id, whatsapp_phone_number_id, system_user_token, whatsapp_access_token')
            .or(filters.join(','))
            .limit(1)
            .maybeSingle();

        if (error) {
            console.warn('[YogiDesk Debug] Meta reply credential lookup failed:', error.message || error);
            return fallbackCredentials;
        }

        return {
            phoneNumberId: data?.meta_phone_number_id || data?.whatsapp_phone_number_id || fallbackCredentials.phoneNumberId,
            accessToken: data?.system_user_token || data?.whatsapp_access_token || fallbackCredentials.accessToken
        };
    } catch (error) {
        console.warn('[YogiDesk Debug] Meta reply credential lookup crashed:', error.message || error);
        return fallbackCredentials;
    }
};

const resolveTrueClinicIdForUser = async (db, userId) => {
    const safeUserId = String(userId || '').trim();
    if (!db?.from || !safeUserId) return null;

    try {
        const { data, error } = await db
            .from('clinics')
            .select('id')
            .eq('user_id', safeUserId)
            .maybeSingle();

        if (data?.id) return data.id;
        if (error && !isSchemaCacheError(error) && error.code !== 'PGRST116' && error.code !== 'PGRST205') {
            console.warn('True clinic id lookup failed:', error.message || error);
        }
    } catch (error) {
        console.warn('True clinic id lookup crashed:', error.message || error);
    }

    return null;
};

const sendWhatsAppTypingIndicator = async ({ inbound = {}, phoneNumberId, businessAccountId } = {}) => {
    const messageId = String(inbound.messageId || '').trim();
    if (!messageId) return { success: false, skipped: true, reason: 'missing_inbound_message_id' };

    try {
        const credentials = await resolveMetaReplyCredentials({
            phoneNumberId: phoneNumberId || inbound.phoneNumberId,
            businessAccountId: businessAccountId || inbound.businessAccountId
        });
        if (!credentials.phoneNumberId || !credentials.accessToken) {
            return { success: false, skipped: true, reason: 'missing_meta_credentials' };
        }

        await axios.post(`https://graph.facebook.com/v20.0/${credentials.phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
            typing_indicator: { type: 'text' }
        }, {
            headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return { success: true };
    } catch (error) {
        console.warn('[YogiDesk Typing Indicator] Meta typing indicator skipped:', error.response?.data || error.message || error);
        return { success: false, error };
    }
};

const forceWriteOutboundWamidToMessages = async ({
    outboundWamid,
    targetClinicId,
    targetPatientNumber,
    generatedAiTextResponse,
    usageMetadata = {},
    inbound = {},
    phoneNumberId,
    businessAccountId
}) => {
    const db = supabaseAdmin || supabase;
    const safeWamid = String(outboundWamid || '').trim();
    const safeText = String(generatedAiTextResponse || '').trim();
    const safePatientNumber = phoneDigitsOnly(targetPatientNumber || inbound.fromPhone || '');
    const safeClinicId = String(targetClinicId || '').trim();
    if (!db?.from || !safeWamid || !safeText || !safePatientNumber) {
        return { success: false, reason: 'missing_required_wamid_fields' };
    }

    const normalizedUsage = normalizeGeminiUsageMetadata(usageMetadata);
    const totalTokens = Math.max(1, parseInt(normalizedUsage.totalSessionTokens, 10) || 1);
    const credits = calculateAiMessageCreditsFromTokens(totalTokens);
    const trueClinicId = await resolveTrueClinicIdForUser(db, safeClinicId);
    const nowIso = new Date().toISOString();
    let payload = removeUndefinedValues({
        wamid: safeWamid,
        clinic_id: trueClinicId || undefined,
        user_id: safeClinicId || null,
        doctor_id: safeClinicId || null,
        patient_number: safePatientNumber,
        patient_phone: safePatientNumber,
        phone: safePatientNumber,
        message_text: safeText,
        message_body: safeText,
        body: safeText,
        text: safeText,
        content: safeText,
        sender_type: 'ai',
        sender: 'bot',
        role: 'assistant',
        direction: 'outbound',
        status: 'SENT',
        message_id: safeWamid,
        meta_message_id: safeWamid,
        metadata: {
            wamid: safeWamid,
            message_id: safeWamid,
            meta_message_id: safeWamid,
            clinic_id: trueClinicId || null,
            doctor_user_id: safeClinicId || null,
            patient_number: safePatientNumber,
            sender_type: 'ai',
            inbound_message_id: inbound.messageId || null,
            whatsapp_business_account_id: businessAccountId || inbound.businessAccountId || null,
            whatsapp_phone_number_id: phoneNumberId || inbound.phoneNumberId || null,
            gemini_reply: true,
            outbound: true,
            ai_billing: {
                pending_webhook_debit: true,
                debited: false,
                input_tokens: normalizedUsage.promptTokens,
                output_tokens: normalizedUsage.candidateTokens,
                total_tokens: totalTokens,
                credits_deducted: credits
            }
        },
        created_at: nowIso
    });
    const removedColumns = new Set();

    while (Object.keys(payload).length > 0) {
        try {
            const { error } = await db
                .from('messages')
                .insert(payload);
            if (!error) return { success: true, totalTokens, credits };

            console.error('[YogiDesk Critical Core] Failed to write outbound WAMID to schema cache.', error.message || error);
            const missingColumn = getMissingSchemaColumn(error);
            if (isSchemaCacheError(error) && missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn) && !removedColumns.has(missingColumn)) {
                removedColumns.add(missingColumn);
                const { [missingColumn]: _removed, ...nextPayload } = payload;
                payload = nextPayload;
                continue;
            }

            return { success: false, error, totalTokens, credits };
        } catch (error) {
            console.error('[YogiDesk Critical Core] Failed to write outbound WAMID to schema cache.', error.message || error);
            return { success: false, error, totalTokens, credits };
        }
    }

    return { success: false, reason: 'empty_payload_after_schema_prune', totalTokens, credits };
};

const sendGeminiWhatsAppTextReply = async ({ toPhone, text, phoneNumberId, businessAccountId, logDelivery = null, commitDelivery = null }) => {
    const safeText = String(text || '').trim();
    if (!toPhone || !safeText) return null;

    const credentials = await resolveMetaReplyCredentials({ phoneNumberId, businessAccountId });
    if (!credentials.phoneNumberId || !credentials.accessToken) {
        throw new Error('Missing Meta phone number ID or access token for Gemini WhatsApp reply.');
    }

    const url = `https://graph.facebook.com/v20.0/${credentials.phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneDigitsOnly(toPhone),
        type: 'text',
        text: {
            preview_url: false,
            body: safeText
        }
    };

    console.log('[YogiDesk Debug] Sending Gemini reply through Meta:', {
        to: payload.to,
        phoneNumberId: credentials.phoneNumberId,
        textLength: safeText.length
    });

    const response = await axios.post(url, payload, {
        headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json'
        },
        timeout: 15000
    });

    console.log('[YogiDesk Debug] Meta reply response:', JSON.stringify(response.data, null, 2));
    const outboundWamid = response.data?.messages?.[0]?.id || null;
    if (!outboundWamid) throw new Error('Meta response missing outbound WAMID for Gemini WhatsApp reply.');

    const preCommittedMessage = await forceWriteOutboundWamidToMessages({
        outboundWamid,
        targetClinicId: logDelivery?.doctorId || commitDelivery?.doctorId || commitDelivery?.doctor?.id || '',
        targetPatientNumber: payload.to,
        generatedAiTextResponse: safeText,
        usageMetadata: commitDelivery?.usageMetadata || {},
        inbound: commitDelivery?.inbound || {},
        phoneNumberId: credentials.phoneNumberId,
        businessAccountId
    });

    if (logDelivery?.doctorId) {
        await logOutboundMessageDelivery({
            doctorId: logDelivery.doctorId,
            patientPhone: payload.to,
            senderType: logDelivery.senderType || 'ai_assistant',
            messageBody: safeText,
            messageType: logDelivery.messageType || 'Session',
            status: 'sent'
        });
    }
    const metaReplyPayload = {
        ...response.data,
        _yogidesk: {
            phoneNumberId: credentials.phoneNumberId,
            outboundWamid,
            preCommittedMessage
        }
    };
    if (commitDelivery?.inbound && commitDelivery?.replyText) {
        metaReplyPayload._yogidesk.inboxCommit = await commitGeminiOutboundReply({
            inbound: commitDelivery.inbound,
            replyText: commitDelivery.replyText,
            metaReply: metaReplyPayload,
            credentials: { phoneNumberId: credentials.phoneNumberId },
            phoneNumberId,
            businessAccountId,
            usageMetadata: commitDelivery.usageMetadata || {},
            preCommittedMessage
        });
    }
    return metaReplyPayload;
};

const extractWhatsAppInboundTextMessages = (payload = {}) => {
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];

    return payload.entry.flatMap((entry) => (
        Array.isArray(entry.changes)
            ? entry.changes.flatMap((change) => {
                if (change.field !== 'messages') return [];
                const value = change.value || {};
                if (!Array.isArray(value.messages) || value.messages.length === 0) {
                    console.log("[YogiDesk Webhook] Received status or non-message event. Skipping AI trigger.");
                    return [];
                }
                const metadata = value.metadata || {};
                const contactsByWaId = new Map((value.contacts || []).map((contact) => [String(contact.wa_id || ''), contact]));

                return value.messages.map((message) => {
                    const text = message.text?.body ||
                        message.button?.text ||
                        message.interactive?.button_reply?.title ||
                        message.interactive?.list_reply?.title ||
                        '';

                    return {
                        messageId: message.id || null,
                        fromPhone: phoneDigitsOnly(message.from || ''),
                        patientName: contactsByWaId.get(String(message.from || ''))?.profile?.name || null,
                        text: String(text || '').trim(),
                        phoneNumberId: String(metadata.phone_number_id || '').trim(),
                        displayPhoneNumber: phoneDigitsOnly(metadata.display_phone_number || ''),
                        businessAccountId: String(metadata.whatsapp_business_account_id || metadata.waba_id || entry.id || '').trim(),
                        raw: message
                    };
                }).filter((message) => message.fromPhone && message.text);
            })
            : []
    ));
};

const normalizeAiPlan = (doctor = {}) => {
    return String(doctor.subscription_tier || doctor.current_plan || doctor.plan || '').trim().toUpperCase();
};

const fetchDoctorAiConfig = async ({ businessAccountId, phoneNumberId, displayPhoneNumber, patientPhone }) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from) return null;
    const doctorNumber = phoneDigitsOnly(displayPhoneNumber || phoneNumberId || '');

    const runProfileQuery = async (filter) => {
        try {
            const { data, error } = await db
                .from('doctor_profiles')
                .select('*')
                .or(filter)
                .limit(1)
                .maybeSingle();
            if (error) {
                if (!isSchemaCacheError(error) && error.code !== 'PGRST205') {
                    console.warn('Doctor AI config lookup failed in doctor_profiles:', error.message || error);
                }
                return null;
            }
            return data ? { ...data, _aiTable: 'doctor_profiles' } : null;
        } catch (error) {
            console.warn('Doctor AI config lookup crashed in doctor_profiles:', error.message || error);
            return null;
        }
    };

    if (doctorNumber) {
        const row = await runProfileQuery(`whatsapp_number.eq.${doctorNumber},meta_phone_number_id.eq.${doctorNumber},whatsapp_phone_number_id.eq.${doctorNumber}`);
        if (row?.id) return row;
    }

    if (businessAccountId) {
        const row = await runProfileQuery(`meta_waba_id.eq.${businessAccountId},whatsapp_business_account_id.eq.${businessAccountId}`);
        if (row?.id) return row;
    }

    if (phoneNumberId) {
        const row = await runProfileQuery(`meta_phone_number_id.eq.${phoneNumberId},whatsapp_phone_number_id.eq.${phoneNumberId}`);
        if (row?.id) return row;
    }

    const ownerId = await resolveGeminiInboxOwner({ businessAccountId, phoneNumberId, patientPhone });
    if (!ownerId) return null;

    try {
        const { data, error } = await db
            .from('doctor_profiles')
            .select('*')
            .eq('id', ownerId)
            .maybeSingle();
        if (!error && data?.id) return { ...data, _aiTable: 'doctor_profiles' };
        if (error && !isSchemaCacheError(error) && error.code !== 'PGRST205') {
            console.warn('Doctor AI config lookup by owner failed in doctor_profiles:', error.message || error);
        }
    } catch (error) {
        console.warn('Doctor AI config owner lookup crashed in doctor_profiles:', error.message || error);
    }

    return null;
};

const getDoctorAiEligibility = (doctor = {}) => {
    const plan = normalizeAiPlan(doctor);
    const aiEnabled = Boolean(doctor.ai_enabled ?? doctor.aiEnabled);
    const messageBalance = Number(
        doctor.ai_message_balance ??
        doctor.aiMessageBalance ??
        doctor.ai_token_balance ??
        doctor.token_limit ??
        doctor.tokenLimit ??
        0
    );
    const messageUsed = Number(doctor.ai_message_used ?? doctor.aiMessageUsed ?? doctor.token_used ?? doctor.tokenUsed ?? 0);
    const isAiPaused = Boolean(doctor.is_ai_paused ?? doctor.isAiPaused);

    if (plan !== 'GROWTH') return { eligible: false, reason: 'growth_plan_required', plan, aiEnabled, messageBalance, messageUsed, isAiPaused };
    if (!aiEnabled) return { eligible: false, reason: 'ai_disabled', plan, aiEnabled, messageBalance, messageUsed, isAiPaused };
    if (isAiPaused) return { eligible: false, reason: 'human_takeover', plan, aiEnabled, messageBalance, messageUsed, isAiPaused };
    if (messageBalance <= 0) return { eligible: false, reason: 'message_credit_depleted', plan, aiEnabled, messageBalance, messageUsed, isAiPaused };
    return { eligible: true, plan, aiEnabled, messageBalance, messageUsed, isAiPaused };
};

const isDoctorSuspendedForMeta = async (doctorId) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !doctorId) return false;

    try {
        const { data, error } = await db
            .from('doctor_profiles')
            .select('*')
            .eq('id', doctorId)
            .maybeSingle();
        if (error) {
            if (!isSchemaCacheError(error)) console.warn('Doctor suspension lookup failed:', error.message || error);
            return false;
        }
        return String(data?.system_status || data?.status || '').toUpperCase() === 'SUSPENDED';
    } catch (error) {
        console.warn('Doctor suspension lookup crashed:', error.message || error);
        return false;
    }
};

const fetchConversationHistory = async ({ chatId, ownerId, patientPhone, limit = GEMINI_HISTORY_MESSAGE_LIMIT }) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from) return [];

    const safeLimit = Math.min(Math.max(Number(limit) || GEMINI_HISTORY_MESSAGE_LIMIT, 1), GEMINI_HISTORY_MESSAGE_LIMIT);
    const historyCutoffIso = new Date(Date.now() - GEMINI_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let query = db
        .from('inbox_messages')
        .select('sender, from_me, body_content, body, text, message_body, message_text, created_at, sender_phone, receiver_phone')
        .gte('created_at', historyCutoffIso)
        .order('created_at', { ascending: false })
        .limit(safeLimit);

    if (chatId) {
        query = query.eq('chat_id', chatId);
    } else if (ownerId) {
        query = query.eq('workspace_id', ownerId);
    }

    const { data, error } = await query;
    if (error) {
        console.warn('Gemini conversation history lookup failed:', error.message || error);
        return [];
    }

    const safePatientPhone = phoneDigitsOnly(patientPhone);
    return (data || [])
        .filter((message) => {
            if (!safePatientPhone || chatId) return true;
            return phoneDigitsOnly(message.sender_phone).endsWith(safePatientPhone.slice(-10)) ||
                phoneDigitsOnly(message.receiver_phone).endsWith(safePatientPhone.slice(-10));
        })
        .slice(0, GEMINI_HISTORY_MESSAGE_LIMIT)
        .reverse()
        .map((message) => {
            const body = message.message_text || message.message_body || message.body_content || message.body || message.text || '';
            const role = message.from_me || ['agent', 'bot'].includes(String(message.sender || '').toLowerCase()) ? 'Assistant' : 'Patient';
            return `${role}: ${String(body || '').trim()}`;
        })
        .filter(Boolean);
};

const shouldFetchAppointmentLookupContext = (text = '') => {
    const normalized = String(text || '').toLowerCase();
    return /\b(appointment|booking|booked|confirm|confirmation|slot|status|schedule|timing|time|date|available|availability)\b/.test(normalized) ||
        /(अपॉइंटमेंट|बुकिंग|कन्फर्म|स्लॉट|समय|तारीख)/i.test(normalized);
};

const fetchAppointmentLookupContext = async ({ doctorId, patientPhone, latestText }) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !doctorId || !shouldFetchAppointmentLookupContext(latestText)) return [];

    const patientDigits = phoneDigitsOnly(patientPhone);
    const cutoffIso = new Date(Date.now() - GEMINI_HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let query = db
        .from('appointments')
        .select('patient_name, patient_phone, appointment_date, appointment_time, status, created_at')
        .or(`user_id.eq.${doctorId},doctor_id.eq.${doctorId}`)
        .gte('created_at', cutoffIso)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false })
        .limit(20);

    if (patientDigits) {
        const last10 = patientDigits.slice(-10);
        query = query.ilike('patient_phone', `%${last10}`);
    }

    const { data, error } = await query;
    if (error) {
        console.warn('[YogiDesk Secure AI] Appointment lookup context failed:', error.message || error);
        return [];
    }

    return (data || [])
        .slice(0, 10)
        .map((appointment) => {
            const date = parseStrictIsoDateOnly(appointment.appointment_date) || sanitizeGeminiContextValue(appointment.appointment_date, '-', 40);
            const time = normalizeAppointmentTimeValue(appointment.appointment_time) || sanitizeGeminiContextValue(appointment.appointment_time, '-', 40);
            return `- ${sanitizeGeminiContextValue(appointment.patient_name, 'Patient', 80)} | ${date} ${time} | ${sanitizeGeminiContextValue(appointment.status, 'Pending', 40)}`;
        });
};

const parseGeminiBookingConfirmation = (replyText = '') => {
    const match = String(replyText || '').match(/\[CONFIRM_BOOKING:\s*([^|\]]+)\s*\|\s*([^|\]]+)\s*\|\s*([^\]]+)\]/i);
    if (!match) {
        return { cleanText: String(replyText || '').trim(), booking: null };
    }

    const booking = {
        patientName: match[1].trim(),
        appointmentDate: match[2].trim(),
        appointmentTime: match[3].trim()
    };
    const cleanText = String(replyText || '').replace(match[0], '').trim();
    return { cleanText, booking };
};

const formatDateOnly = (date) => {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseStrictIsoDateOnly = (value) => {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return '';
    return formatDateOnly(parsed);
};

const parseLooseAppointmentDate = (value) => {
    const rawValue = String(value || '').trim();
    const dmyMatch = rawValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
        const day = Number(dmyMatch[1]);
        const month = Number(dmyMatch[2]);
        const year = Number(dmyMatch[3]);
        return parseStrictIsoDateOnly(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }

    const parsed = new Date(rawValue);
    if (!Number.isFinite(parsed.getTime())) return '';
    return formatDateOnly(parsed);
};

const parseRelativeAppointmentDate = (value) => {
    let rawDate = sanitizeGeminiContextValue(value, '', 80);
    if (!rawDate) return '';
    const strictIsoDate = parseStrictIsoDateOnly(rawDate);
    if (strictIsoDate) return strictIsoDate;

    const normalized = rawDate.toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (normalized.includes('after tomorrow') ||
        normalized.includes('day after tomorrow') ||
        normalized.includes('parso') ||
        normalized.includes('parson') ||
        normalized.includes('परसों')) {
        today.setDate(today.getDate() + 2);
        rawDate = formatDateOnly(today);
    } else if (normalized.includes('tomorrow') ||
        normalized.includes('kal') ||
        normalized.includes('कल')) {
        today.setDate(today.getDate() + 1);
        rawDate = formatDateOnly(today);
    }

    return parseStrictIsoDateOnly(rawDate) || parseLooseAppointmentDate(rawDate);
};

const normalizeAppointmentDateValue = (value) => parseRelativeAppointmentDate(value);
const toTimeString = (hours, minutes = 0) => {
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return '';
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const normalizeAppointmentTimeValue = (value) => {
    const rawValue = sanitizeGeminiContextValue(value, '', 40);
    if (!rawValue) return '';

    const strictMatch = rawValue.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (strictMatch) return toTimeString(Number(strictMatch[1]), Number(strictMatch[2]));

    let rawTime = rawValue.trim().toUpperCase();
    rawTime = rawTime
        .replace(/\bDOPEHAR\b/g, 'PM')
        .replace(/\bDOPAHAR\b/g, 'PM')
        .replace(/\bSHAAM\b/g, 'PM')
        .replace(/\bSHAM\b/g, 'PM')
        .replace(/\bSUBAH\b/g, 'AM')
        .replace(/\bSAVERE\b/g, 'AM')
        .replace(/\bBAJE\b/g, '')
        .replace(/\bO'?CLOCK\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const meridiemMatch = rawTime.match(/(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)\b/);
    if (meridiemMatch) {
        let hours = Number(meridiemMatch[1]);
        const minutes = meridiemMatch[2] ? Number(meridiemMatch[2]) : 0;
        const isPm = meridiemMatch[3] === 'PM';
        if (isPm && hours < 12) hours += 12;
        if (!isPm && hours === 12) hours = 0;
        return toTimeString(hours, minutes);
    }

    const spokenMatch = rawTime.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
    if (spokenMatch) {
        let hours = Number(spokenMatch[1]);
        const minutes = spokenMatch[2] ? Number(spokenMatch[2]) : 0;
        if (hours >= 1 && hours <= 9) hours += 12;
        return toTimeString(hours, minutes);
    }

    return '';
};
const normalizeAppointmentNameValue = (value) => sanitizeGeminiContextValue(value, 'Patient', 120);

const resolveDoctorNotificationPhone = (doctor = {}) => {
    const candidates = [
        doctor.phone,
        doctor.mobile,
        doctor.phone_number,
        doctor.whatsapp_number,
        doctor.owner_phone,
        doctor.clinic_phone
    ];
    return phoneDigitsOnly(candidates.find((candidate) => phoneDigitsOnly(candidate)) || '');
};

const buildDoctorAppointmentNotification = (appointment = {}) => [
    'Hello Doctor,',
    '',
    'You have received a NEW Appointment booking via YogiDesk AI!',
    '',
    `📌 Patient Name: ${appointment.patient_name || 'Patient'}`,
    `📞 Phone: ${appointment.patient_phone || '-'}`,
    `📅 Date: ${appointment.appointment_date || '-'}`,
    `⏰ Time: ${appointment.appointment_time || '-'}`,
    '',
    'Please check your YogiDesk Appointments Tab for more details.'
].join('\n');

const notifyDoctorOfAppointment = async ({ doctor = {}, inbound = {}, appointment = {} }) => {
    const doctorPhone = resolveDoctorNotificationPhone(doctor);
    if (!doctorPhone) return { success: false, reason: 'doctor_phone_missing' };

    try {
        await sendGeminiWhatsAppTextReply({
            toPhone: doctorPhone,
            text: buildDoctorAppointmentNotification(appointment),
            phoneNumberId: doctor.meta_phone_number_id || doctor.whatsapp_phone_number_id || inbound.phoneNumberId,
            businessAccountId: doctor.meta_waba_id || doctor.whatsapp_business_account_id || inbound.businessAccountId
        });
        return { success: true };
    } catch (error) {
        console.warn('Doctor appointment WhatsApp notification failed:', error.message || error);
        return { success: false, reason: 'notification_failed', error };
    }
};

const insertWithSchemaFallback = async ({ table, row, dbClient = supabaseAdmin || supabase }) => {
    if (!dbClient?.from || !table || !row) return { success: false, reason: 'database_unavailable' };
    let payload = removeUndefinedValues(row);
    const removedColumns = new Set();

    while (Object.keys(payload).length > 0) {
        const { data, error } = await dbClient.from(table).insert([payload]).select().maybeSingle();
        if (!error) return { success: true, data };

        const missingColumn = getMissingSchemaColumn(error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn) && !removedColumns.has(missingColumn)) {
            removedColumns.add(missingColumn);
            const { [missingColumn]: _removed, ...nextPayload } = payload;
            payload = nextPayload;
            continue;
        }

        return { success: false, error };
    }

    return { success: false, reason: 'empty_payload' };
};

const logOutboundMessageDelivery = async ({
    doctorId,
    patientPhone,
    senderType,
    messageBody,
    messageType = 'Session',
    status = 'sent'
}) => {
    const db = supabaseAdmin || supabase;
    const safeDoctorId = String(doctorId || '').trim();
    const safePatientPhone = phoneDigitsOnly(patientPhone || '');
    const safeMessageBody = sanitizeGeminiContextValue(messageBody, '', 2000);
    if (!db?.from || !safeDoctorId || !safePatientPhone || !safeMessageBody) return { success: false, skipped: true };

    const sentAt = new Date().toISOString();
    const results = await Promise.allSettled([
        insertWithSchemaFallback({
            table: 'message_logs',
            dbClient: db,
            row: {
                doctor_id: safeDoctorId,
                patient_phone: safePatientPhone,
                sender_type: senderType || 'ai_assistant',
                message_body: safeMessageBody,
                status
            }
        }),
        insertWithSchemaFallback({
            table: 'whatsapp_message_logs',
            dbClient: db,
            row: {
                doctor_id: safeDoctorId,
                recipient_phone: safePatientPhone,
                patient_phone: safePatientPhone,
                sender_type: senderType || 'ai_assistant',
                message_body: safeMessageBody,
                message_type: messageType,
                delivery_status: status,
                status,
                sent_at: sentAt,
                created_at: sentAt
            }
        })
    ]);

    for (const result of results) {
        const value = result.value || {};
        if (result.status === 'rejected' || (!value.success && !isSchemaCacheError(value.error))) {
            console.warn('Delivery report log insert skipped:', result.reason?.message || value.error?.message || value.reason || 'unknown');
        }
    }

    return { success: results.some((result) => result.status === 'fulfilled' && result.value?.success) };
};

const bookPatientAppointment = async ({
    doctor = {},
    inbound = {},
    patientName,
    patientPhone,
    appointmentDate,
    appointmentTime,
    source = 'whatsapp_gemini',
    metadata = {}
}) => {
    const db = supabaseAdmin || supabase;
    const doctorId = String(doctor?.id || '').trim();
    const safePatientName = normalizeAppointmentNameValue(patientName || inbound.patientName);
    const safePatientPhone = phoneDigitsOnly(patientPhone || inbound.fromPhone || '');
    const safeAppointmentDate = normalizeAppointmentDateValue(appointmentDate);
    const safeAppointmentTime = normalizeAppointmentTimeValue(appointmentTime);

    if (!db?.from || !isUuid(doctorId) || !safePatientName || !safePatientPhone || !safeAppointmentDate || !safeAppointmentTime) {
        return { success: false, reason: 'missing_required_appointment_fields' };
    }

    const nowIso = new Date().toISOString();
    const result = await insertWithSchemaFallback({
        table: 'appointments',
        dbClient: db,
        row: {
            user_id: doctorId,
            doctor_id: doctorId,
            patient_name: safePatientName,
            patient_phone: safePatientPhone,
            appointment_date: safeAppointmentDate,
            appointment_time: safeAppointmentTime,
            status: 'Pending',
            source,
            metadata: {
                ...metadata,
                inbound_message_id: inbound.messageId || null,
                whatsapp_business_account_id: inbound.businessAccountId || null,
                whatsapp_phone_number_id: inbound.phoneNumberId || null,
                created_by_ai: source === 'whatsapp_gemini',
                tool_name: 'bookPatientAppointment'
            },
            created_at: nowIso,
            updated_at: nowIso
        }
    });

    if (!result.success) return result;

    const appointment = result.data || {
        patient_name: safePatientName,
        patient_phone: safePatientPhone,
        appointment_date: safeAppointmentDate,
        appointment_time: safeAppointmentTime,
        status: 'Pending'
    };
    await notifyDoctorOfAppointment({ doctor, inbound, appointment });
    return { success: true, data: appointment };
};

const saveGeminiAppointment = async ({ doctor, inbound, booking }) => {
    if (!booking?.patientName || !booking?.appointmentDate || !booking?.appointmentTime) {
        return { success: false, reason: 'missing_booking_payload' };
    }

    try {
        const result = await bookPatientAppointment({
            doctor,
            inbound,
            patientName: booking.patientName,
            patientPhone: inbound.fromPhone,
            appointmentDate: booking.appointmentDate,
            appointmentTime: booking.appointmentTime
        });
        if (!result.success) console.error('Gemini appointment save failed:', result.error?.message || result.error || result.reason);
        return result;
    } catch (error) {
        console.error('Gemini appointment save crashed:', error.message || error);
        return { success: false, reason: 'appointment_save_crashed', error };
    }
};

const calculateAiMessageCreditsFromTokens = (totalTokenCount) => {
    const totalTokens = Math.max(1, Math.ceil(Number(totalTokenCount || 0)));
    if (totalTokens <= 100) return 1;
    if (totalTokens <= 200) return 2;
    if (totalTokens <= 300) return 3;
    if (totalTokens <= 400) return 4;
    if (totalTokens <= 500) return 5;
    if (totalTokens <= 600) return 6;
    return Math.max(1, Math.ceil(totalTokens / 100));
};

const normalizeGeminiUsageMetadata = (usageMetadata = {}) => {
    const promptTokens = Number(
        usageMetadata.prompt_token_count ??
        usageMetadata.promptTokenCount ??
        usageMetadata.inputTokenCount ??
        0
    );
    const candidateTokens = Number(
        usageMetadata.candidates_token_count ??
        usageMetadata.candidatesTokenCount ??
        usageMetadata.outputTokenCount ??
        0
    );
    const totalSessionTokens = Math.max(1, Math.ceil((Number.isFinite(promptTokens) ? promptTokens : 0) + (Number.isFinite(candidateTokens) ? candidateTokens : 0)));
    return {
        promptTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
        candidateTokens: Number.isFinite(candidateTokens) ? candidateTokens : 0,
        totalSessionTokens
    };
};

const insertWalletPassbookEntry = async ({
    doctorId,
    patientPhone,
    entryType,
    amount = 0,
    messagesDelta = 0,
    description,
    metadata = {}
}) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !doctorId) return { success: false, reason: 'database_unavailable' };

    const safeDescription = String(description || '').replace(/\bTokens?\b/gi, 'Messages').trim();
    const { error } = await db.from('wallet_passbook').insert([{
        user_id: doctorId,
        doctor_id: doctorId,
        patient_number: patientPhone ? phoneDigitsOnly(patientPhone) : null,
        entry_type: entryType,
        amount: Number(amount || 0),
        messages_delta: Number(messagesDelta || 0),
        description: safeDescription,
        metadata,
        created_at: new Date().toISOString()
    }]);

    if (error) {
        if (!isSchemaCacheError(error)) console.warn('Wallet passbook insert failed:', error.message || error);
        return { success: false, reason: 'insert_failed', error };
    }

    return { success: true };
};

const deductDoctorAiMessageCredit = async ({ doctor = {}, usageMetadata = {}, patientPhone = '' }) => {
    const db = supabaseAdmin || supabase;
    const doctorId = doctor.id;
    if (!db?.from || !doctorId) return { success: false, reason: 'database_unavailable' };

    const safeTable = ['doctors', 'doctor_profiles', 'profiles'].includes(doctor._aiTable) ? doctor._aiTable : 'doctor_profiles';
    const currentBalance = Number(
        doctor.ai_message_balance ??
        doctor.aiMessageBalance ??
        doctor.ai_token_balance ??
        doctor.token_limit ??
        0
    );
    const currentUsed = Number(doctor.ai_message_used ?? doctor.aiMessageUsed ?? doctor.token_used ?? 0);
    const {
        promptTokens: inputTokens,
        candidateTokens: outputTokens,
        totalSessionTokens: totalTokens
    } = normalizeGeminiUsageMetadata(usageMetadata);
    const creditsToDeduct = calculateAiMessageCreditsFromTokens(totalTokens);
    const nextBalance = Math.max(0, currentBalance - creditsToDeduct);
    const nextUsed = currentUsed + creditsToDeduct;
    const lastAiUsage = {
        provider: 'gemini',
        model: GEMINI_MODEL_NAME,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        credits_deducted: creditsToDeduct,
        charged_at: new Date().toISOString()
    };
    const normalizedPatientPhone = phoneDigitsOnly(patientPhone);
    const formattedPatientPhone = normalizedPatientPhone
        ? `+${normalizedPatientPhone.length === 10 ? `91${normalizedPatientPhone}` : normalizedPatientPhone}`
        : 'Patient';
    const passbookDescription = `Patient: ${formattedPatientPhone} | AI Conversation Session Completed: -${creditsToDeduct} Credits Deducted`;

    const payload = {
        ai_message_balance: nextBalance,
        ai_message_used: nextUsed,
        token_used: nextUsed,
        last_ai_usage: lastAiUsage
    };
    const totalTokensInteger = Math.max(1, parseInt(lastAiUsage.total_tokens, 10) || 1);

    let update = { error: null, data: null };
    if (db.rpc) {
        update = await db.rpc('debit_ai_message_balance', {
            p_user_id: doctorId,
            p_messages: creditsToDeduct,
            p_usage: totalTokensInteger
        });
    }

    if (update.error) {
        console.warn('AI message RPC deduction unavailable, falling back to guarded profile update:', update.error.message || update.error);
        update = await db.from(safeTable).update(payload).eq('id', doctorId).gt('ai_message_balance', 0);
    }
    if (update.error && isSchemaCacheError(update.error)) {
        const fallbackPayload = {
            ai_message_balance: nextBalance,
            token_used: nextUsed
        };
        update = await db.from(safeTable).update(fallbackPayload).eq('id', doctorId);
    }
    if (update.error && isSchemaCacheError(update.error)) {
        update = await db.from(safeTable).update({
            ai_token_balance: nextBalance,
            token_limit: nextBalance,
            token_used: nextUsed
        }).eq('id', doctorId);
    }

    if (update.error) {
        console.warn(`AI message credit deduction failed in ${safeTable}:`, update.error.message || update.error);
        return { success: false, reason: 'update_failed', error: update.error };
    }

    await insertWalletPassbookEntry({
        doctorId,
        patientPhone,
        entryType: 'AI_MESSAGE_DEBIT',
        messagesDelta: -creditsToDeduct,
        description: passbookDescription,
        metadata: {
            provider: 'gemini',
            model: GEMINI_MODEL_NAME,
            usage: lastAiUsage
        }
    });

    return {
        success: true,
        aiMessageBalance: nextBalance,
        aiMessageUsed: nextUsed,
        messagesDeducted: creditsToDeduct,
        usage: lastAiUsage
    };
};

const runGeminiForWhatsAppMessage = async ({ inbound, doctor, chatId, languageCode = 'hi' }) => {
    const history = await fetchConversationHistory({
        chatId,
        ownerId: doctor?.id,
        patientPhone: inbound.fromPhone
    });
    const clinicKnowledgeBase = await fetchClinicKnowledgeBaseForDoctor(doctor?.id);
    const appointmentLookupContext = await fetchAppointmentLookupContext({
        doctorId: doctor?.id,
        patientPhone: inbound.fromPhone,
        latestText: inbound.text
    });
    const systemInstruction = buildGeminiSystemInstruction(clinicKnowledgeBase || {});
    const prompt = [
        systemInstruction,
        '',
        'Conversation so far:',
        history.length ? history.join('\n') : 'No earlier messages.',
        '',
        'Direct appointment database lookup for slot/status validation:',
        appointmentLookupContext.length ? appointmentLookupContext.join('\n') : 'No direct appointment rows matched this request.',
        '',
        `Latest Patient Message: ${String(inbound.text || '').slice(0, 2048)}`,
        `Preferred language: ${languageCode}.`
    ].join('\n');

    let response;
    try {
        response = await generateGeminiContentWithRetry(prompt);
    } catch (error) {
        console.error('[YogiDesk Secure AI] Execution bypassed due to model interface code');
        return {
            success: false,
            model: GEMINI_MODEL_NAME,
            skipped: true,
            reason: 'model_interface_code',
            replyText: '',
            usageMetadata: {},
            tokenIncrement: 0
        };
    }

    const replyText = String(response?.response?.text?.() || '').trim();
    const usageMetadata = response?.response?.usageMetadata || response?.response?.usage_metadata || response?.usage_metadata || {};
    const normalizedUsage = normalizeGeminiUsageMetadata(usageMetadata);
    return {
        success: true,
        model: GEMINI_MODEL_NAME,
        replyText,
        usageMetadata,
        tokenIncrement: normalizedUsage.totalSessionTokens
    };
};

const phonesReferToSameContact = (left, right) => {
    const leftParts = getPhoneMatchParts(left);
    const rightParts = getPhoneMatchParts(right);
    if (!leftParts.digits || !rightParts.digits) return false;
    if (leftParts.digits === rightParts.digits) return true;
    if (leftParts.last10 && rightParts.last10 && leftParts.last10 === rightParts.last10) return true;
    const rightVariants = new Set(rightParts.variants.map((item) => phoneDigitsOnly(item)));
    return leftParts.variants.some((variant) => rightVariants.has(phoneDigitsOnly(variant)));
};

const findInboxChatByOwnerAndPhone = async ({ ownerId, phone }) => {
    if (!supabase?.from || !ownerId || !phone) return null;
    const { data, error } = await supabase
        .from('inbox_chats')
        .select('id, phone, patient_phone, metadata, updated_at')
        .or(`user_id.eq.${ownerId},doctor_id.eq.${ownerId}`)
        .order('updated_at', { ascending: false })
        .limit(500);

    if (error) {
        console.error('Inbox chat lookup before message insert failed:', error.message || error);
        return null;
    }

    const matches = (data || []).filter((chat) => (
        phonesReferToSameContact(chat.phone, phone) ||
        phonesReferToSameContact(chat.patient_phone, phone)
    ));
    matches.sort((left, right) => {
        const leftEstablished = left.metadata?.last_template || left.metadata?.template_id || left.metadata?.template_name ? 1 : 0;
        const rightEstablished = right.metadata?.last_template || right.metadata?.template_id || right.metadata?.template_name ? 1 : 0;
        if (leftEstablished !== rightEstablished) return rightEstablished - leftEstablished;
        const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0;
        const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0;
        return rightTime - leftTime;
    });

    return matches[0]?.id ? matches[0] : null;
};

const writeTemplateDispatchChat = async ({ ownerId, activePhone, activeName, messageText, status, metadata, nowIso }) => {
    const existingChat = await findInboxChatByOwnerAndPhone({ ownerId, phone: activePhone });
    const payload = {
        user_id: ownerId,
        doctor_id: ownerId,
        phone: activePhone,
        patient_phone: activePhone,
        name: activeName,
        patient_name: activeName,
        last_message: messageText,
        status,
        unread_count: 0,
        window_expires_at: null,
        whatsapp_window_expires_at: null,
        updated_at: nowIso,
        metadata: {
            ...(existingChat?.metadata || {}),
            window_expires_at: null,
            whatsapp_window_expires_at: null,
            last_template: metadata
        }
    };

    const query = existingChat?.id
        ? supabase.from('inbox_chats').update(payload).eq('id', existingChat.id).select('id, metadata').maybeSingle()
        : supabase.from('inbox_chats').insert([payload]).select('id, metadata').maybeSingle();
    const { data, error } = await query;

    if (error) {
        console.error('Inbox chat write before message insert failed:', error.message || error);
        return existingChat || null;
    }

    return data?.id ? data : existingChat || null;
};

const writeGeminiInboxChatSafely = async ({ db, chatId, payload }) => {
    let nextPayload = removeUndefinedValues(payload);
    const removedColumns = new Set();

    while (Object.keys(nextPayload).length > 0) {
        const query = chatId
            ? db.from('inbox_chats').update(nextPayload).eq('id', chatId).select('id, metadata').maybeSingle()
            : db.from('inbox_chats').insert([nextPayload]).select('id, metadata').maybeSingle();
        const { data, error } = await query;
        if (!error) return data;

        const missingColumn = getMissingSchemaColumn(error);
        if (missingColumn && Object.prototype.hasOwnProperty.call(nextPayload, missingColumn) && !removedColumns.has(missingColumn)) {
            console.warn(`Gemini inbox chat write retrying without stale schema column: ${missingColumn}`);
            removedColumns.add(missingColumn);
            const { [missingColumn]: _removed, ...strippedPayload } = nextPayload;
            nextPayload = strippedPayload;
            continue;
        }

        console.error('Gemini inbox chat write failed:', error.message || error);
        return null;
    }

    return null;
};

const resolveGeminiInboxOwner = async ({ businessAccountId, phoneNumberId, patientPhone }) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from) return null;

    if (businessAccountId) {
        const { data, error } = await db
            .from('doctor_profiles')
            .select('id')
            .or(`meta_waba_id.eq.${businessAccountId},whatsapp_business_account_id.eq.${businessAccountId}`)
            .limit(1)
            .maybeSingle();
        if (data?.id) return data.id;
        if (error) console.warn('Gemini reply owner lookup by WABA failed:', error.message || error);
    }

    if (phoneNumberId) {
        const { data, error } = await db
            .from('doctor_profiles')
            .select('id')
            .or(`meta_phone_number_id.eq.${phoneNumberId},whatsapp_phone_number_id.eq.${phoneNumberId}`)
            .limit(1)
            .maybeSingle();
        if (data?.id) return data.id;
        if (error) console.warn('Gemini reply owner lookup by Meta phone failed:', error.message || error);
    }

    if (patientPhone) {
        const { data, error } = await db
            .from('inbox_chats')
            .select('user_id, doctor_id, phone, patient_phone, updated_at')
            .order('updated_at', { ascending: false })
            .limit(500);
        if (error) {
            console.warn('Gemini reply owner lookup by patient phone failed:', error.message || error);
        } else {
            const existingChat = (data || []).find((chat) => (
                phonesReferToSameContact(chat.phone, patientPhone) ||
                phonesReferToSameContact(chat.patient_phone, patientPhone)
            ));
            if (existingChat?.user_id || existingChat?.doctor_id) return existingChat.user_id || existingChat.doctor_id;
        }
    }

    return null;
};

const findGeminiReplyChat = async ({ db, ownerId, patientPhone }) => {
    if (!db?.from || !patientPhone) return null;

    let query = db
        .from('inbox_chats')
        .select('id, user_id, doctor_id, phone, patient_phone, name, patient_name, metadata, updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);

    if (ownerId) query = query.or(`user_id.eq.${ownerId},doctor_id.eq.${ownerId}`);

    const { data, error } = await query;
    if (error) {
        console.warn('Gemini reply chat lookup failed:', error.message || error);
        return null;
    }

    return (data || []).find((chat) => (
        phonesReferToSameContact(chat.phone, patientPhone) ||
        phonesReferToSameContact(chat.patient_phone, patientPhone)
    )) || null;
};

const commitGeminiOutboundReply = async ({
    inbound = {},
    replyText,
    metaReply,
    credentials = {},
    phoneNumberId,
    businessAccountId,
    usageMetadata = {},
    preCommittedMessage = null
}) => {
    const wamid = metaReply?.messages?.[0]?.id || metaReply?.message_id || metaReply?.wamid || null;
    const safeText = String(replyText || '').trim();
    const patientPhone = phoneDigitsOnly(inbound.fromPhone || inbound.toPhone || '');
    if (!wamid || !safeText || !patientPhone) return { success: false, reason: 'missing_required_reply_fields' };

    const db = supabaseAdmin || supabase;
    if (!db?.from) return { success: false, reason: 'database_unavailable' };

    const finalPhoneNumberId = String(credentials.phoneNumberId || phoneNumberId || inbound.phoneNumberId || '').trim();
    const finalBusinessAccountId = String(businessAccountId || inbound.businessAccountId || '').trim();
    const ownerId = await resolveGeminiInboxOwner({
        businessAccountId: finalBusinessAccountId,
        phoneNumberId: finalPhoneNumberId,
        patientPhone
    });
    const nowIso = new Date().toISOString();
    const normalizedUsage = normalizeGeminiUsageMetadata(usageMetadata);
    const totalTokens = Math.max(1, parseInt(normalizedUsage.totalSessionTokens, 10) || 1);
    const credits = calculateAiMessageCreditsFromTokens(totalTokens);
    const trueClinicId = await resolveTrueClinicIdForUser(db, ownerId || existingChat?.user_id || existingChat?.doctor_id);
    const aiBillingMetadata = {
        pending_webhook_debit: true,
        debited: false,
        input_tokens: normalizedUsage.promptTokens,
        output_tokens: normalizedUsage.candidateTokens,
        total_tokens: totalTokens,
        credits_deducted: credits
    };
    const existingChat = await findGeminiReplyChat({ db, ownerId, patientPhone });
    const chatMetadata = existingChat?.metadata || {};

    let chatId = existingChat?.id || null;
    if (!chatId && ownerId) {
        const createdChat = await writeGeminiInboxChatSafely({
            db,
            payload: {
                user_id: ownerId,
                doctor_id: ownerId,
                name: inbound.patientName || 'Patient',
                patient_name: inbound.patientName || 'Patient',
                phone: patientPhone,
                patient_phone: patientPhone,
                last_message: safeText,
                status: 'SENT',
                unread_count: 0,
                updated_at: nowIso,
                metadata: {
                    whatsapp_business_account_id: finalBusinessAccountId || null,
                    whatsapp_phone_number_id: finalPhoneNumberId || null,
                    conversation_state: 'BOT_REPLIED',
                    last_bot_reply: { wamid, sent_at: nowIso, body_preview: safeText.slice(0, 500) }
                }
            }
        });
        chatId = createdChat?.id || null;
    }

    if (!isUuid(chatId)) {
        console.error('Gemini outbound reply skipped inbox_messages insert: no valid chat id resolved.', {
            wamid,
            ownerId,
            patientPhone
        });
        return { success: false, reason: 'chat_not_resolved', wamid };
    }

    const row = {
        chat_id: chatId,
        workspace_id: ownerId || existingChat?.user_id || existingChat?.doctor_id || null,
        sender_id: ownerId || existingChat?.user_id || existingChat?.doctor_id || null,
        sender_phone: finalPhoneNumberId || null,
        receiver_phone: patientPhone,
        sender: 'bot',
        from_me: true,
        type: 'public',
        message_type: 'text',
        status: 'SENT',
        message_id: wamid,
        meta_message_id: wamid,
        wamid,
        body: safeText,
        text: safeText,
        body_content: safeText,
        message_body: safeText,
        message_text: safeText,
        is_private_note: false,
        metadata: {
            wamid,
            message_id: wamid,
            meta_message_id: wamid,
            whatsapp_business_account_id: finalBusinessAccountId || null,
            whatsapp_phone_number_id: finalPhoneNumberId || null,
            inbound_message_id: inbound.messageId || null,
            gemini_reply: true,
            outbound: true,
            ai_billing: aiBillingMetadata,
            meta_response: metaReply
        },
        created_at: nowIso
    };

    const insertResult = await insertInboxMessageWithSchemaFallback(row, db);
    if (!insertResult.success) {
        console.error('Gemini outbound reply inbox_messages insert failed:', insertResult.error?.message || insertResult.error || insertResult.reason);
        return { success: false, reason: 'message_insert_failed', error: insertResult.error, wamid, chatId };
    }

    let messagesCommit = preCommittedMessage?.success ? preCommittedMessage : null;
    if (!messagesCommit) {
        messagesCommit = await insertWithSchemaFallback({
            table: 'messages',
            dbClient: db,
            row: {
                ...row,
                user_id: ownerId || existingChat?.user_id || existingChat?.doctor_id || null,
                doctor_id: ownerId || existingChat?.user_id || existingChat?.doctor_id || null,
                clinic_id: trueClinicId || undefined,
                patient_number: patientPhone,
                patient_phone: patientPhone,
                phone: patientPhone,
                direction: 'outbound',
                role: 'assistant',
                sender_type: 'ai',
                content: safeText,
                status: 'SENT',
                message_id: wamid,
                meta_message_id: wamid,
                wamid,
                metadata: {
                    ...(row.metadata || {}),
                    messages_transaction_inserted_at: nowIso
                }
            }
        });
    }
    if (!messagesCommit.success) {
        console.warn('Gemini outbound reply messages table insert failed:', messagesCommit.error?.message || messagesCommit.error || messagesCommit.reason);
    }

    await writeGeminiInboxChatSafely({
        db,
        chatId,
        payload: {
            last_message: safeText,
            status: 'SENT',
            unread_count: 0,
            updated_at: nowIso,
            metadata: {
                ...chatMetadata,
                whatsapp_business_account_id: finalBusinessAccountId || chatMetadata.whatsapp_business_account_id || null,
                whatsapp_phone_number_id: finalPhoneNumberId || chatMetadata.whatsapp_phone_number_id || null,
                conversation_state: 'BOT_REPLIED',
                last_bot_reply: {
                    wamid,
                    message_id: wamid,
                    sent_at: nowIso,
                    body_preview: safeText.slice(0, 500),
                    inbound_message_id: inbound.messageId || null
                }
            }
        }
    });

    return { success: true, wamid, chatId, messagesCommit };
};

const handleGeminiWhatsAppMessage = async ({ payload, message, languageCode = 'hi', sendReplies = false }) => {
    const rawInboundMessages = message ? [message] : extractWhatsAppInboundTextMessages(payload);
    const results = [];

    if (!Array.isArray(rawInboundMessages) || rawInboundMessages.length === 0) {
        console.log("[YogiDesk Webhook] Received status or non-message event. Skipping AI trigger.");
        return results;
    }

    const inboundMessages = await debounceGeminiInbounds(rawInboundMessages);
    if (!Array.isArray(inboundMessages) || inboundMessages.length === 0) {
        return results;
    }

    for (const inbound of inboundMessages) {
        const dedupeKey = buildGeminiDedupeKey({ ...inbound, languageCode });
        const now = Date.now();
        pruneGeminiCaches(now);

        const cachedResult = geminiResultCache.get(dedupeKey);
        if (cachedResult && now - cachedResult.storedAt <= GEMINI_RESULT_CACHE_MS) {
            results.push({ ...cachedResult.result, dedupe: { cacheHit: true, suppressedDuplicate: true } });
            continue;
        }

        const activeProcessing = geminiProcessingCache.get(dedupeKey);
        if (activeProcessing && now - activeProcessing.startedAt <= GEMINI_BOUNCE_WINDOW_MS) {
            const sharedResult = await activeProcessing.promise;
            results.push({ ...sharedResult, dedupe: { cacheHit: false, suppressedDuplicate: true } });
            continue;
        }

        const processingPromise = (async () => {
            const doctor = await fetchDoctorAiConfig({
                businessAccountId: inbound.businessAccountId,
                phoneNumberId: inbound.phoneNumberId,
                displayPhoneNumber: inbound.displayPhoneNumber,
                patientPhone: inbound.fromPhone
            });

            if (!doctor?.id) {
                return {
                    ...inbound,
                    ai: { provider: 'gemini', skipped: true, reason: 'doctor_not_found' },
                    replyTexts: [],
                    metaReplies: []
                };
            }

            if (await isDoctorSuspendedForMeta(doctor.id)) {
                return {
                    ...inbound,
                    doctorId: doctor.id,
                    ai: { provider: 'gemini', skipped: true, reason: 'workspace_suspended' },
                    replyTexts: [],
                    metaReplies: []
                };
            }

            const eligibility = getDoctorAiEligibility(doctor);
            if (!eligibility.eligible) {
                return {
                    ...inbound,
                    doctorId: doctor.id,
                    ai: { provider: 'gemini', skipped: true, reason: eligibility.reason, eligibility },
                    replyTexts: [],
                    metaReplies: []
                };
            }

            const db = supabaseAdmin || supabase;
            const existingChat = await findGeminiReplyChat({
                db,
                ownerId: doctor.id,
                patientPhone: inbound.fromPhone
            });
            sendWhatsAppTypingIndicator({
                inbound,
                phoneNumberId: inbound.phoneNumberId,
                businessAccountId: inbound.businessAccountId
            }).catch((error) => console.warn('[YogiDesk Typing Indicator] Async dispatch failed:', error.message || error));

            try {
                const geminiResult = await runGeminiForWhatsAppMessage({
                    inbound,
                    doctor,
                    chatId: existingChat?.id || null,
                    languageCode
                });

                if (geminiResult?.skipped) {
                    return {
                        ...inbound,
                        doctorId: doctor.id,
                        ai: { provider: 'gemini', skipped: true, reason: geminiResult.reason || 'model_interface_code' },
                        replyTexts: [],
                        bookingReady: false,
                        bookingPayload: null,
                        metaReplies: []
                    };
                }

                const { cleanText, booking } = parseGeminiBookingConfirmation(geminiResult.replyText);
                const bookingSave = booking
                    ? await saveGeminiAppointment({ doctor, inbound, booking })
                    : null;

                const finalReplyText = cleanText || geminiResult.replyText;
                const result = {
                    ...inbound,
                    doctorId: doctor.id,
                    ai: { provider: 'gemini', skipped: false, result: geminiResult },
                    replyTexts: finalReplyText ? [finalReplyText] : [],
                    bookingReady: Boolean(booking),
                    bookingPayload: booking,
                    bookingSave,
                    metaReplies: []
                };

                if (sendReplies && finalReplyText) {
                    try {
                        const humanReplyDelayMs = calculateHumanReplyDelayMs(finalReplyText);
                        console.log('[YogiDesk AI] Waiting before Gemini reply for human-like pacing.', {
                            messageId: inbound.messageId,
                            delayMs: humanReplyDelayMs,
                            replyLength: finalReplyText.length
                        });
                        await wait(humanReplyDelayMs);
                        const metaReply = await sendGeminiWhatsAppTextReply({
                            toPhone: inbound.fromPhone,
                            text: finalReplyText,
                            phoneNumberId: inbound.phoneNumberId,
                            businessAccountId: inbound.businessAccountId,
                            logDelivery: {
                                doctorId: doctor.id,
                                senderType: 'ai_assistant',
                                messageType: 'Session'
                            },
                            commitDelivery: {
                                inbound,
                                replyText: finalReplyText,
                                doctorId: doctor.id,
                                doctor,
                                usageMetadata: geminiResult.usageMetadata || {}
                            }
                        });
                        const inboxCommit = metaReply?._yogidesk?.inboxCommit || null;
                        const creditDebit = {
                            success: true,
                            pendingWebhookDebit: true,
                            reason: 'debit_deferred_until_meta_status_match'
                        };
                        result.metaReplies.push({ success: true, response: metaReply, inboxCommit, creditDebit });
                        console.log('[YogiDesk AI] Response successfully sent to patient.');
                    } catch (sendError) {
                        console.error('[YogiDesk Debug] Gemini Meta reply send failed:', {
                            messageId: inbound.messageId,
                            fromPhone: inbound.fromPhone,
                            error: sendError.response?.data || sendError.message || sendError
                        });
                        result.metaReplies.push({
                            success: false,
                            error: sendError.response?.data || sendError.message || 'Meta reply send failed.'
                        });
                    }
                }

                return result;
            } catch (error) {
                console.error('[YogiDesk Secure AI] Execution bypassed due to model interface code');

                return {
                    ...inbound,
                    doctorId: doctor.id,
                    ai: { provider: 'gemini', success: false, error: 'model_interface_code' },
                    replyTexts: [],
                    bookingReady: false,
                    bookingPayload: null,
                    metaReplies: []
                };
            }
        })().catch((error) => {
            console.error('[YogiDesk Secure AI] Execution bypassed due to model interface code');
            return {
                ...inbound,
                ai: { provider: 'gemini', success: false, error: 'model_interface_code' },
                replyTexts: [],
                bookingReady: false,
                bookingPayload: null,
                metaReplies: []
            };
        });

        geminiProcessingCache.set(dedupeKey, { startedAt: now, promise: processingPromise });
        try {
            const result = await processingPromise;
            geminiResultCache.set(dedupeKey, { storedAt: Date.now(), result });
            results.push(result);
        } finally {
            geminiProcessingCache.delete(dedupeKey);
        }
    }

    return results;
};

const handleWhatsAppGeminiWebhook = async (req, res) => {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    if (!value || !Array.isArray(value.messages) || value.messages.length === 0) {
        console.log("[YogiDesk Webhook] Received status or non-message event. Skipping AI trigger.");
        return res.sendStatus(200);
    }

    try {
        Promise.resolve()
            .then(() => handleGeminiWhatsAppMessage({
                payload: req.body,
                languageCode: process.env.GEMINI_LANGUAGE_CODE || 'hi',
                sendReplies: true
            }))
            .catch((error) => console.error('Gemini WhatsApp webhook background processing failed:', error.message || error));
        return res.sendStatus(200);
    } catch (error) {
        console.error('Gemini WhatsApp webhook receiver failed:', error.message || error);
        return res.sendStatus(200);
    }
};

const resolveScheduledIso = (scheduledFor, index = 0) => {
    const parsed = scheduledFor ? new Date(scheduledFor) : null;
    const date = parsed && Number.isFinite(parsed.getTime())
        ? parsed
        : new Date(Date.now() + Number(index || 0) * 3 * 60 * 1000);
    return date.toISOString();
};

const cleanMetaAxiosError = (error) => {
    let providerMessage = error?.message || 'Meta request failed.';
    try {
        const data = error?.response?.data;
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                providerMessage = parsed?.error?.message || parsed?.message || data;
            } catch {
                providerMessage = data;
            }
        } else if (data && typeof data === 'object') {
            providerMessage = data?.error?.message || data?.message || providerMessage;
        }
    } catch {
        providerMessage = error?.message || 'Meta request failed.';
    }

    return {
        success: false,
        msg: providerMessage,
        message: providerMessage,
        status: error?.response?.status || 500
    };
};

const buildCampaignQueuePayload = ({ userId, doctorId: requestDoctorId, template = {}, recipient = {}, scheduledFor, index = 0 }) => {
    const doctorId = requestDoctorId || userId || template.doctor_id || template.user_id || null;
    const resolvedUserId = userId || requestDoctorId || template.user_id || template.doctor_id || null;
    const variables = template.variables || template.variablesData || template.payload?.variables || {};
    const templateText = template.templateText || template.bodyText || template.body_text || template.messageBody || template.body_content || template.text || '';
    const recipientPhone = String(recipient.patientPhone || recipient.phone || recipient.recipient_phone || '').trim();
    const scheduledIso = resolveScheduledIso(scheduledFor, index);
    return {
        user_id: resolvedUserId,
        doctor_id: doctorId,
        template_id: template.id || null,
        template_name: template.template_name || template.name || 'WhatsApp Template',
        template_category: template.category || 'UTILITY',
        phone_number_id: template.phone_number_id || template.whatsapp_phone_number_id || template.meta_phone_number_id || null,
        whatsapp_phone_number_id: template.whatsapp_phone_number_id || template.meta_phone_number_id || template.phone_number_id || null,
        language: template.language || 'en_US',
        recipient_name: String(recipient.patientName || recipient.name || recipient.recipient_name || 'Patient').trim(),
        recipient_phone: recipientPhone,
        phone: recipientPhone,
        message_body: templateText,
        payload: {
            template,
            recipient,
            variables,
            text: templateText
        },
        status: 'PENDING',
        scheduled_for: scheduledIso,
        scheduled_at: scheduledIso
    };
};

const buildMinimalCampaignQueuePayload = (row = {}) => ({
    template_name: row.template_name || row.payload?.template?.template_name || row.payload?.template?.name || 'WhatsApp Template',
    status: row.status || 'PENDING',
    doctor_id: row.doctor_id || row.user_id || null,
    user_id: row.user_id || row.doctor_id || null,
    language: row.language || row.payload?.template?.language || 'en_US',
    recipient_phone: row.recipient_phone || row.phone || row.payload?.recipient?.phone || '',
    phone: row.phone || row.recipient_phone || row.payload?.recipient?.phone || '',
    message_body: row.message_body || row.payload?.text || row.payload?.template?.templateText || row.payload?.template?.bodyText || row.payload?.template?.body_text || row.payload?.template?.messageBody || row.payload?.template?.body_content || '',
    payload: {
        variables: row.payload?.variables || row.payload?.template?.variables || row.payload?.template?.variablesData || {},
        text: row.payload?.text || row.payload?.template?.templateText || row.payload?.template?.bodyText || row.payload?.template?.body_text || row.payload?.template?.messageBody || row.payload?.template?.body_content || ''
    }
});

const buildQueuedInboxChatPayload = ({ userId, doctorId: requestDoctorId, template = {}, recipient = {}, scheduledFor, index = 0 }) => {
    const doctorId = requestDoctorId || userId || template.doctor_id || template.user_id || null;
    const resolvedUserId = userId || requestDoctorId || template.user_id || template.doctor_id || null;
    const recipientName = String(recipient.patientName || recipient.name || recipient.recipient_name || 'Patient').trim();
    const recipientPhone = String(recipient.patientPhone || recipient.phone || recipient.recipient_phone || '').trim();
    const scheduledIso = resolveScheduledIso(scheduledFor, index);
    return {
        user_id: resolvedUserId,
        doctor_id: doctorId,
        name: recipientName || 'Patient',
        patient_name: recipientName || 'Patient',
        patient_phone: recipientPhone || 'unknown',
        phone: recipientPhone || 'unknown',
        last_message: `Queued: ${template.template_name || template.name || 'WhatsApp Template'}`,
        status: 'QUEUED',
        unread_count: 0,
        scheduled_at: scheduledIso,
        window_expires_at: null,
        whatsapp_window_expires_at: null,
        updated_at: new Date().toISOString(),
        metadata: {
            template_id: template.id || null,
            template_name: template.template_name || template.name || 'WhatsApp Template',
            template_category: template.category || 'UTILITY',
            window_expires_at: null,
            whatsapp_window_expires_at: null,
            recipient,
        }
    };
};

const insertCampaignQueueRows = async ({ rows = [], fallbackRows = [] }) => {
    if (!supabase?.from || !Array.isArray(rows) || rows.length === 0) {
        return { inserted: false, fallbackRequired: true };
    }

    try {
        const { error } = await supabase.from('campaign_queue').insert(rows);
        if (error) throw error;
        return { inserted: true, fallbackRequired: false };
    } catch (error) {
        const isPostgrestFailure = error?.code || error?.response?.status === 400 || isSchemaCacheError(error);
        if (isSchemaCacheError(error)) {
            try {
                const safeFallbackRows = fallbackRows.length > 0
                    ? fallbackRows.map(buildMinimalCampaignQueuePayload)
                    : rows.map(buildMinimalCampaignQueuePayload);
                if (safeFallbackRows.length > 0) {
                    const { error: fallbackError } = await supabase.from('campaign_queue').insert(safeFallbackRows);
                    if (fallbackError) throw fallbackError;
                    return { inserted: true, fallbackRequired: false };
                }
            } catch (fallbackError) {
                return { inserted: false, fallbackRequired: true, error: fallbackError };
            }
            return { inserted: false, fallbackRequired: true, error };
        }

        if (isPostgrestFailure) return { inserted: false, fallbackRequired: true, error };

        return { inserted: false, fallbackRequired: true, error };
    }
};

const insertQueuedInboxChatRows = async ({ rows = [] }) => {
    if (!supabase?.from || !Array.isArray(rows) || rows.length === 0) return { inserted: false };
    const db = supabaseAdmin || supabase;

    try {
        for (const row of rows) {
            const phone = row.phone || row.patient_phone || 'unknown';
            const payload = {
                ...row,
                phone,
                patient_phone: row.patient_phone || phone,
                window_expires_at: null,
                whatsapp_window_expires_at: null,
                updated_at: row.updated_at || new Date().toISOString(),
            };

            const { data: existingChat, error: lookupError } = await db
                .from('inbox_chats')
                .select('id')
                .eq('phone', phone)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (lookupError) throw lookupError;

            const result = existingChat?.id
                ? await db.from('inbox_chats').update(payload).eq('id', existingChat.id)
                : await db.from('inbox_chats').insert([payload]);
            if (result.error) throw result.error;
        }
        return { inserted: true };
    } catch (error) {
        logInboxDatabaseError(error);
    }

    const fallbackRows = rows.map((row) => ({
        name: row.name || row.patient_name || 'Patient',
        phone: row.phone || row.patient_phone || 'unknown',
        patient_name: row.patient_name || row.name || 'Patient',
        patient_phone: row.patient_phone || row.phone || 'unknown',
        status: row.status,
        doctor_id: row.doctor_id || row.user_id || null,
        scheduled_at: resolveScheduledIso(row.scheduled_at),
    }));
    const minimalRows = rows.map((row) => ({
        name: row.name || row.patient_name || 'Patient',
        phone: row.phone || row.patient_phone || 'unknown',
        patient_name: row.patient_name || row.name || 'Patient',
        patient_phone: row.patient_phone || row.phone || 'unknown',
        status: row.status,
        doctor_id: row.doctor_id || row.user_id || null
    }));

    try {
        const { error } = await db.from('inbox_chats').insert(fallbackRows);
        if (error) throw error;
        return { inserted: true };
    } catch (error) {
        logInboxDatabaseError(error);
        try {
            const { error: fallbackError } = await db.from('inbox_chats').insert(fallbackRows);
            if (fallbackError) throw fallbackError;
            return { inserted: true };
        } catch (fallbackError) {
            logInboxDatabaseError(fallbackError);
            try {
                const { error: minimalError } = await db.from('inbox_chats').insert(minimalRows);
                if (minimalError) throw minimalError;
                return { inserted: true };
            } catch (minimalError) {
                logInboxDatabaseError(minimalError);
                return { inserted: false, error: minimalError };
            }
        }
    }
};

const logInboxDatabaseError = (error) => {
    const message = String(error?.message || error?.details || error || '');
    const normalized = message.toLowerCase();
    if (error?.code === 'PGRST205' || normalized.includes('schema cache') || normalized.includes('inbox_chats') || normalized.includes('inbox_messages')) {
        console.error("Supabase Inbox Logging Crash:", message);
        return;
    }
    console.error("Supabase Inbox Logging Error:", message);
};

const safeInsertInboxRows = async ({ table = 'inbox', rows = [] }) => {
    if (!supabase?.from || !Array.isArray(rows) || rows.length === 0) return { inserted: false };
    try {
        const { error } = await supabase.from(table).insert(rows);
        if (error) throw error;
        return { inserted: true };
    } catch (error) {
        logInboxDatabaseError(error);
        return { inserted: false, error };
    }
};

const extractVariableValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'object') return String(value).trim();

    return String(
        value.value ||
        value.sample ||
        value.example ||
        value.text ||
        value.customValue ||
        value.custom ||
        value.label ||
        value.field ||
        ''
    ).trim();
};

const collectTemplateVariables = (body = {}) => {
    const variableSources = [
        body.variablesData,
        body.variables,
        body.variableMapping,
        body.variableMappings,
        body.mappings,
        body.customVariables
    ];
    const variablesData = {};

    variableSources.forEach((source) => {
        if (!source) return;

        if (Array.isArray(source)) {
            source.forEach((item, index) => {
                if (item === null || item === undefined) return;
                const key = String(item.index || item.position || item.key || item.variable || item.placeholder || index + 1).replace(/\D/g, '');
                if (!key) return;
                const value = extractVariableValue(item);
                if (value) variablesData[key] = value;
            });
            return;
        }

        if (typeof source === 'object') {
            Object.entries(source).forEach(([rawKey, rawValue]) => {
                const key = String(rawKey).replace(/\D/g, '');
                if (!key) return;
                const value = extractVariableValue(rawValue);
                if (value) variablesData[key] = value;
            });
        }
    });

    const sortedKeys = Object.keys(variablesData).sort((a, b) => Number(a) - Number(b));
    return sortedKeys.map(key => variablesData[key]);
};

const getActiveDoctorId = (req) => {
    const authUser = req.user || req.auth?.user || req.session?.user || {};
    return (
        authUser.doctor_id ||
        authUser.doctorId ||
        authUser.id ||
        authUser._id?.toString?.() ||
        req.auth?.doctor_id ||
        req.auth?.doctorId ||
        req.session?.doctor_id ||
        req.session?.doctorId ||
        null
    );
};

const getDoctorMetaCredentials = async (doctorId) => {
    if (!supabase || !doctorId) return {};

    const lookupColumns = ['doctor_id', 'id', 'user_id'];
    const credentialLookups = [{
        select: '*',
        map: (row) => ({
            phoneNumberId: row?.meta_phone_number_id || row?.whatsapp_phone_number_id || null,
            businessAccountId: row?.meta_waba_id || row?.whatsapp_business_account_id || null,
            accessToken: row?.system_user_token || row?.whatsapp_access_token || null
        })
    }];
    let data = null;
    let lastError = null;

    for (const column of lookupColumns) {
        for (const lookup of credentialLookups) {
            const result = await supabase
                .from('doctor_profiles')
                .select(lookup.select)
                .eq(column, doctorId)
                .maybeSingle();

            if (result.error) {
                const message = String(result.error?.message || result.error?.details || '').toLowerCase();
                const isMissingColumn = result.error?.code === '42703' || result.error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
                if (isMissingColumn) continue;
                lastError = result.error;
                continue;
            }

            const credentials = lookup.map(result.data || {});
            if (credentials.phoneNumberId && credentials.businessAccountId && credentials.accessToken) {
                data = credentials;
                lastError = null;
                break;
            }

            if (result.data) {
                lastError = null;
            }
        }

        if (data) break;
    }

    if (lastError || !data) {
        if (lastError) console.warn('Meta credential lookup failed:', lastError.message);
        else console.error('Fresh Meta credentials missing or empty for template submission.', { doctorId });
        return {};
    }

    return data;
};

/**
 * Validates Meta Credentials against Graph API
 */
const validateMetaCredentials = async ({ phoneNumberId, businessAccountId, accessToken }) => {
    try {
        await axios.get(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
            params: { fields: 'id,display_phone_number,verified_name' },
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });
        await axios.get(`https://graph.facebook.com/v21.0/${businessAccountId}`, {
            params: { fields: 'id,name' },
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000
        });
        return true;
    } catch (error) {
        console.error('Meta validation error:', error.response?.data || error.message);
        return false;
    }
};

const isMissingColumnError = (error) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const cleanStoredCredential = (value) => {
    const normalized = String(value || '').trim();
    return normalized && normalized !== 'CONFIGURED' ? normalized : '';
};

const isNumericMetaId = (value) => /^\d+$/.test(String(value || '').trim());

const hasCompleteMetaCredentials = (row = {}) => Boolean(
    cleanStoredCredential(row.meta_phone_number_id || row.whatsapp_phone_number_id) &&
    cleanStoredCredential(row.meta_waba_id || row.whatsapp_business_account_id) &&
    cleanStoredCredential(row.system_user_token || row.whatsapp_access_token)
);

const getExistingMetaCredentialState = async (client, userId) => {
    const result = await client
        .from('doctor_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (!result.error) return result.data || {};
    if (!isMissingColumnError(result.error)) throw result.error;
    return {};
};

/**
 * Dedicated handler for saving Meta Connection credentials.
 * Strictly avoids supabase.auth.updateUser() to prevent session resets.
 */
exports.saveMetaConnection = async (req, res) => {
    try {
        const sessionUser = req.user; // Assumes user is attached via middleware
        if (!sessionUser?.id) {
            return res.status(401).json({ success: false, message: "Authenticated doctor session is required." });
        }

        const {
            whatsappPhoneNumberId,
            whatsappWabaId,
            whatsappBusinessAccountId,
            whatsappAccessToken,
            metaPhoneNumberId,
            metaWabaId,
            systemUserToken,
            name,
            email
        } = req.body;
        
        const phoneNumberId = String(whatsappPhoneNumberId || metaPhoneNumberId || '').trim();
        const businessAccountId = String(whatsappWabaId || whatsappBusinessAccountId || metaWabaId || '').trim();
        const accessToken = String(whatsappAccessToken || systemUserToken || '').trim();

        if (!phoneNumberId || !businessAccountId || !accessToken) {
            return res.status(400).json({ success: false, message: "Invalid Meta configuration. All credentials are required." });
        }

        if (!isNumericMetaId(phoneNumberId) || !isNumericMetaId(businessAccountId)) {
            return res.status(400).json({ success: false, message: "Meta Phone Number ID and WABA ID must be numeric IDs." });
        }

        const client = supabaseAdmin || supabase;
        if (!client?.from) throw new Error('Supabase admin client unavailable.');

        const existingMetaConfig = await getExistingMetaCredentialState(client, sessionUser.id);
        if (hasCompleteMetaCredentials(existingMetaConfig)) {
            return res.status(403).json({
                success: false,
                message: META_CONFIGURATION_LOCKED_MESSAGE,
                is_locked: true
            });
        }

        const profilePayload = {
            meta_phone_number_id: phoneNumberId,
            meta_waba_id: businessAccountId,
            system_user_token: accessToken,
            ...(name && { name: String(name).trim() }),
            ...(email && { email: String(email).trim() })
        };
        const legacyProfilePayload = {
            whatsapp_phone_number_id: phoneNumberId,
            whatsapp_business_account_id: businessAccountId,
            whatsapp_access_token: accessToken,
            ...(name && { name: String(name).trim() }),
            ...(email && { email: String(email).trim() })
        };

        let { error } = await client
            .from('doctor_profiles')
            .upsert({ id: sessionUser.id, ...profilePayload }, { onConflict: 'id' });

        if (error && isMissingColumnError(error)) {
            const fallbackResult = await client
                .from('doctor_profiles')
                .upsert({ id: sessionUser.id, ...legacyProfilePayload }, { onConflict: 'id' });
            error = fallbackResult.error;
        }

        if (error) throw error;

        return res.status(200).json({ success: true, message: "Meta credentials updated successfully." });
    } catch (error) {
        console.error('Meta save failure:', error.message || error);
        return res.status(500).json({ success: false, message: error.message || 'Meta credentials update failed.' });
    }
};

// 1. Send Test Message Function
exports.sendTestMessage = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        const doctorId = getActiveDoctorId(req);

        if (!phoneNumber) {
            return res.status(400).json({ success: false, msg: 'phoneNumber is required' });
        }

        if (!doctorId) {
            return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        }

        const credentials = await getDoctorMetaCredentials(doctorId);
        const phoneId = credentials.phoneNumberId;
        const accessToken = credentials.accessToken;

        if (!phoneId || !credentials.businessAccountId) {
            return res.status(400).json(missingSubAccountConfigResponse);
        }

        if (!accessToken) {
            return res.status(500).json({ success: false, message: 'WhatsApp API authorization is not configured.' });
        }

        const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
        const data = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'template',
            template: {
                name: 'hello_world',
                language: { code: 'en_US' }
            }
        };

        const config = {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(url, data, config);

        const metaMessageId = response.data?.messages?.[0]?.id || null;
        console.log("=== TEMPLATE SENT ===", {
            metaMessageId,
            fullResponse: response.data,
            hasId: !!metaMessageId
        });

        // --- REAL-TIME INBOX LOGGING ---
        try {
            const activePhone = String(req.body.patientPhone || req.body.phone || req.body.phoneNumber || '').replace(/\D/g, '');
            const activeName = req.body.patientName || req.body.name || 'Patient';
            const ownerId = req.body.userId || req.body.doctorId || doctorId;
            const nowIso = new Date().toISOString();

            const messageText = req.body.templateText || 'Template Sent';
            const deliveryMetadata = {
                wamid: metaMessageId,
                message_id: metaMessageId,
                meta_message_id: metaMessageId,
                whatsapp_business_account_id: credentials.businessAccountId || null,
                whatsapp_phone_number_id: phoneId || null,
                template_name: req.body.templateName || 'hello_world',
                delivery_status: 'SENT',
                sent_at: nowIso
            };

            // 1. Resolve the exact owner-scoped inbox_chats parent before inserting the child row.
            const chatRow = await writeTemplateDispatchChat({
                ownerId,
                activePhone,
                activeName,
                messageText,
                status: 'SENT',
                metadata: deliveryMetadata,
                nowIso
            });

            if (!isUuid(chatRow?.id)) {
                console.error('Inbox message insert skipped: no valid inbox_chats parent UUID resolved.', {
                    ownerId,
                    activePhone,
                    chatId: chatRow?.id || null,
                    metaMessageId
                });
                return res.status(200).json({
                    success: true,
                    msg: "Message sent successfully!",
                    data: response.data,
                    inboxLogged: false
                });
            }

            // 2. Insert the outbound message directly into inbox_messages
            const absoluteMessageRow = {
                chat_id: chatRow.id,
                body: req.body.templateText || `Template: ${req.body.templateName || 'hello_world'}`,
                text: req.body.templateText || `Template: ${req.body.templateName || 'hello_world'}`,
                message_body: req.body.templateText || `Template: ${req.body.templateName || 'hello_world'}`,
                sender: 'doctor',
                from_me: true,
                type: 'template',
                message_type: 'text',
                status: 'SENT',
                wamid: metaMessageId,
                meta_message_id: metaMessageId,
                message_id: metaMessageId,
                workspace_id: ownerId,
                sender_id: ownerId,
                sender_phone: phoneId,
                receiver_phone: activePhone,
                metadata: {
                    ...deliveryMetadata,
                    inbox_chat_id: chatRow.id
                },
                created_at: nowIso
            };
            const messageInsert = await insertInboxMessageWithSchemaFallback(absoluteMessageRow);
            if (!messageInsert.success) {
                console.error('Inbox message insert failed after schema-safe fallback:', messageInsert.error?.message || messageInsert.error || 'unknown error');
            }
        } catch (dbError) {
            console.error("Database Backfill Failed:", dbError);
        }

        res.status(200).json({ 
            success: true, 
            msg: "Message sent successfully!", 
            data: response.data 
        });

    } catch (error) {
        const metaError = cleanMetaAxiosError(error);
        console.error("WhatsApp Error:", metaError.message);
        if (error.response?.status === 401) {
            console.error("CRITICAL: Meta Cloud API Token is Invalid or Expired. Please regenerate a Permanent System User Access Token in the Meta Business Suite.");
            return res.status(401).json({
                success: false,
                msg: "Meta Authentication Failed. Please check your Permanent Access Token in Settings."
            });
        }
        res.status(500).json({ 
            success: false, 
            msg: "Message failed", 
            error: metaError.message
        });
    }
};

// 3. Sync Template Status Pipeline
exports.syncTemplateStatus = async (req, res) => {
    try {
        const doctorId = getActiveDoctorId(req);
        if (!doctorId) {
            return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        }

        // Fetch all stored templates for this doctor
        const { data: templates, error: dbError } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('user_id', doctorId);

        if (dbError) throw dbError;

        const profile = await getDoctorMetaCredentials(doctorId);

        if (!profile?.businessAccountId || !profile?.accessToken) {
            return res.status(400).json({ success: false, message: "Meta configuration missing." });
        }

        const updatedTemplates = [];

        for (const template of templates) {
            try {
                const url = `https://graph.facebook.com/v21.0/${profile.businessAccountId}/message_templates`;
                const response = await axios.get(url, {
                    params: {
                        name: template.template_name,
                        access_token: profile.accessToken
                    }
                });

                const metaTemplate = response.data.data?.[0];
                if (metaTemplate) {
                    const rawStatus = metaTemplate.status.toUpperCase();
                    const trueStatus = rawStatus === 'PENDING_REVIEW' ? 'PENDING' : rawStatus;
                    
                    if (trueStatus !== template.status) {
                        await supabase
                            .from('whatsapp_templates')
                            .update({ status: trueStatus })
                            .eq('id', template.id);
                        
                        updatedTemplates.push({ id: template.id, name: template.template_name, status: trueStatus });
                    }
                }
            } catch (err) {
                console.error(`Sync failure for ${template.template_name}:`, err.message);
            }
        }

        return res.status(200).json({ success: true, updatedTemplates });
    } catch (error) {
        console.error("Manual Sync Pipeline Error:", error.message);
        res.status(500).json({ success: false, message: 'Sync pipeline failed' });
    }
};

// 2. Submit Template Function
exports.submitTemplate = async (req, res) => {
    try {
        const {
            templateName,
            templateText,
            category: incomingCategory,
            language,
            headerType,
            headerText,
            footerText,
            buttons,
            messaging_product: messagingProduct = 'whatsapp'
        } = req.body;
        const doctorId = getActiveDoctorId(req);

        if (!doctorId) {
            return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        }

        const name = (templateName || '').trim();
        const body = templateText;
        let category = name === 'yogi_auth_otp' ? 'AUTHENTICATION' : incomingCategory;

        if (!name || !category || !language || !body) {
            return res.status(400).json({ success: false, message: 'Missing required fields: templateName, category, language, templateText' });
        }

        const credentials = await getDoctorMetaCredentials(doctorId);
        const businessAccountId = credentials.businessAccountId;
        const accessToken = credentials.accessToken;

        if (!credentials.phoneNumberId || !businessAccountId) {
            return res.status(400).json(missingSubAccountConfigResponse);
        }

        if (!accessToken) {
            return res.status(500).json({ success: false, message: 'WhatsApp API authorization is not configured.' });
        }

        console.log("Extracted variablesData payload:", JSON.stringify(req.body.variablesData || req.body.variableMapping || req.body.variableMappings || req.body.variables || {}));

        let components = [];

        if (name === 'yogi_auth_otp') {
            components = [
                {
                    type: 'body',
                    text: "{{1}} is your verification code. For your security, do not share this code.",
                    example: {
                        body_text: [["123456"]]
                    }
                },
                {
                    type: 'buttons',
                    buttons: [
                        {
                            type: 'otp',
                            otp_type: 'COPY_CODE',
                            text: 'Copy Code',
                            example: ["123456"]
                        }
                    ]
                }
            ];
        } else {
            const samplesArray = collectTemplateVariables(req.body);
            
            components = [
                {
                    type: 'body',
                    text: req.body.templateText
                }
            ];

            if (samplesArray.length > 0) {
                components[0].example = {
                    body_text: [samplesArray]
                };
            }

            if (headerType && headerType !== 'NONE') {
                components.unshift({
                    type: 'header',
                    format: String(headerType).toLowerCase(),
                    ...(headerType === 'TEXT' && { text: headerText })
                });
            }

            if (footerText) {
                components.push({
                    type: 'footer',
                    text: footerText
                });
            }

            if (buttons && buttons.length > 0) {
                components.push({
                    type: 'buttons',
                    buttons: buttons
                        .map((btn) => {
                            const text = String(btn.text || '').trim();
                            if (!text) return null;
                            if (String(btn.type || '').toUpperCase() === 'URL') {
                                const url = String(btn.url || '').trim();
                                return url ? { type: 'url', text, url } : null;
                            }
                            const phoneNumber = String(btn.phone_number || btn.phone || '').trim().replace(/^\+/, '').replace(/\D/g, '');
                            const normalizedPhone = phoneNumber.length === 10 ? `91${phoneNumber}` : phoneNumber;
                            return normalizedPhone ? { type: 'phone_number', text, phone_number: normalizedPhone } : null;
                        })
                        .filter(Boolean)
                        .slice(0, 2)
                });
            }
        }

        const url = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;
        const data = {
            messaging_product: messagingProduct,
            name,
            language,
            category,
            parameter_format: 'positional',
            components
        };

        const config = {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(url, data, config);
        
        // Save to DB
        const Template = require('../models/Template');
        const newTemplate = await Template.create({
            name,
            bodyText: templateText,
            headerType: headerType || 'NONE',
            headerText: headerText || '',
            category,
            status: 'PENDING_REVIEW',
            metaTemplateId: response.data.id || response.data.message_template_id,
            businessId: doctorId
        });

        console.log("Template Submitted ID:", response.data.id);
        res.status(200).json({
            success: true,
            message: 'Template submitted successfully',
            data: { ...response.data, dbId: newTemplate._id }
        });

    } catch (error) {
        const metaError = cleanMetaAxiosError(error);
        console.error("Meta Absolute Array Failure:", metaError.message);
        if (error.response?.status === 401) {
            console.error("CRITICAL: Meta Cloud API Token is Invalid or Expired. Please regenerate a Permanent System User Access Token in the Meta Business Suite.");
            return res.status(401).json({
                success: false,
                msg: "Meta Authentication Failed. Please check your Permanent Access Token in Settings."
            });
        }
        res.status(500).json({
            success: false,
            message: 'Template submission failed',
            error: metaError.message
        });
    }
};

exports.shouldBypassCampaignWalletCheck = shouldBypassCampaignWalletCheck;
exports.buildCampaignQueuePayload = buildCampaignQueuePayload;
exports.buildQueuedInboxChatPayload = buildQueuedInboxChatPayload;
exports.insertCampaignQueueRows = insertCampaignQueueRows;
exports.insertQueuedInboxChatRows = insertQueuedInboxChatRows;
exports.safeInsertInboxRows = safeInsertInboxRows;
exports.logInboxDatabaseError = logInboxDatabaseError;
exports.extractWhatsAppInboundTextMessages = extractWhatsAppInboundTextMessages;
exports.handleGeminiWhatsAppMessage = handleGeminiWhatsAppMessage;
exports.handleWhatsAppGeminiWebhook = handleWhatsAppGeminiWebhook;
exports.sendGeminiWhatsAppTextReply = sendGeminiWhatsAppTextReply;
exports.bookPatientAppointment = bookPatientAppointment;
