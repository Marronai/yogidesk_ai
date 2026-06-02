require('dotenv').config();
const axios = require('axios');
const { SessionsClient } = require('@google-cloud/dialogflow-cx');
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

const insertInboxMessageWithSchemaFallback = async (row = {}) => {
    const stableMetadata = {
        ...(row.metadata || {}),
        ...(row.message_id ? { message_id: row.message_id } : {}),
        ...(row.meta_message_id ? { meta_message_id: row.meta_message_id } : {})
    };
    let payload = { ...row, metadata: stableMetadata };
    const removedColumns = new Set();

    for (let attempt = 0; attempt < 4; attempt += 1) {
        const { error } = await supabase.from('inbox_messages').insert(payload);
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
const sanitizeDialogflowPathSegment = (value) => String(value || '').trim().replace(/[^\w.-]/g, '_');
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

let dialogflowSessionsClient;

const getDialogflowCxConfig = () => {
    const projectId = String(process.env.DIALOGFLOW_PROJECT_ID || process.env.GOOGLE_PROJECT_ID || '').trim();
    const location = String(process.env.DIALOGFLOW_LOCATION || 'global').trim();
    const rawAgentId = String(process.env.DIALOGFLOW_AGENT_ID || '').trim();
    const agentId = rawAgentId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || rawAgentId;

    if (!projectId || !location || !agentId) {
        throw new Error('Dialogflow CX config missing. Set GOOGLE_PROJECT_ID/DIALOGFLOW_PROJECT_ID, DIALOGFLOW_LOCATION, and DIALOGFLOW_AGENT_ID.');
    }

    return { projectId, location, agentId };
};

const getDialogflowSessionsClient = () => {
    if (!dialogflowSessionsClient) {
        const { location } = getDialogflowCxConfig();
        const clientOptions = location && location !== 'global'
            ? { apiEndpoint: `${location}-dialogflow.googleapis.com` }
            : undefined;

        dialogflowSessionsClient = new SessionsClient(clientOptions);
    }

    return dialogflowSessionsClient;
};

const unwrapDialogflowValue = (value) => {
    if (!value || typeof value !== 'object') return value;
    if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, 'numberValue')) return value.numberValue;
    if (Object.prototype.hasOwnProperty.call(value, 'boolValue')) return value.boolValue;
    if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
    if (value.listValue?.values) return value.listValue.values.map(unwrapDialogflowValue);
    if (value.structValue?.fields) return unwrapDialogflowStruct(value.structValue);
    return value;
};

const unwrapDialogflowStruct = (struct = {}) => {
    if (!struct?.fields || typeof struct.fields !== 'object') return struct || {};
    return Object.fromEntries(
        Object.entries(struct.fields).map(([key, value]) => [key, unwrapDialogflowValue(value)])
    );
};

const normalizeDialogflowParameters = (parameters = {}) => (
    parameters?.fields ? unwrapDialogflowStruct(parameters) : parameters || {}
);

const extractDialogflowTextResponses = (queryResult = {}) => {
    const responseMessages = Array.isArray(queryResult.responseMessages) ? queryResult.responseMessages : [];
    const texts = responseMessages.flatMap((message) => {
        const text = message.text?.text;
        return Array.isArray(text) ? text : [];
    });

    return texts.map((text) => String(text || '').trim()).filter(Boolean);
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

const sendDialogflowWhatsAppTextReply = async ({ toPhone, text, phoneNumberId, businessAccountId }) => {
    const safeText = String(text || '').trim();
    if (!toPhone || !safeText) return null;

    const credentials = await resolveMetaReplyCredentials({ phoneNumberId, businessAccountId });
    if (!credentials.phoneNumberId || !credentials.accessToken) {
        throw new Error('Missing Meta phone number ID or access token for Dialogflow WhatsApp reply.');
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

    console.log('[YogiDesk Debug] Sending Dialogflow reply through Meta:', {
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
    return response.data;
};

const extractWhatsAppInboundTextMessages = (payload = {}) => {
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];

    return payload.entry.flatMap((entry) => (
        Array.isArray(entry.changes)
            ? entry.changes.flatMap((change) => {
                if (change.field !== 'messages') return [];
                const value = change.value || {};
                const metadata = value.metadata || {};
                const contactsByWaId = new Map((value.contacts || []).map((contact) => [String(contact.wa_id || ''), contact]));

                return (value.messages || []).map((message) => {
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
                        businessAccountId: String(metadata.whatsapp_business_account_id || metadata.waba_id || entry.id || '').trim(),
                        raw: message
                    };
                }).filter((message) => message.fromPhone && message.text);
            })
            : []
    ));
};

const runDialogflowCxForWhatsAppMessage = async ({ fromPhone, text, languageCode = 'hi' }) => {
    if (!fromPhone || !text) {
        throw new Error('Dialogflow CX dispatch requires both fromPhone and text.');
    }

    const { projectId, location, agentId } = getDialogflowCxConfig();
    const sessionsClient = getDialogflowSessionsClient();
    const sessionId = sanitizeDialogflowPathSegment(phoneDigitsOnly(fromPhone));
    const session = sessionsClient.projectLocationAgentSessionPath(projectId, location, agentId, sessionId);

    console.log('[YogiDesk Debug] GOOGLE_PROJECT_ID:', process.env.GOOGLE_PROJECT_ID);
    console.log('[YogiDesk Debug] DIALOGFLOW_LOCATION:', process.env.DIALOGFLOW_LOCATION);
    console.log('[YogiDesk Debug] DIALOGFLOW_AGENT_ID:', process.env.DIALOGFLOW_AGENT_ID);
    console.log('[YogiDesk Debug] Dialogflow CX session path:', session);

    let response;
    try {
        [response] = await sessionsClient.detectIntent({
            session,
            queryInput: {
                text: { text: String(text).slice(0, 2048) },
                languageCode
            }
        });
        console.log("[YogiDesk Debug] Full Dialogflow Raw Response:", JSON.stringify(response, null, 2));
    } catch (error) {
        console.error('[YogiDesk Debug] Dialogflow detectIntent failed:', {
            session,
            fromPhone: phoneDigitsOnly(fromPhone),
            languageCode,
            error: error.message || error
        });
        throw error;
    }

    const queryResult = response?.queryResult || {};
    const sessionParameters = normalizeDialogflowParameters(
        queryResult.currentPage?.playbookInfo?.sessionParameters || queryResult.parameters || {}
    );
    const bookingPayload = {
        patient_name: sessionParameters.patient_name || null,
        appointment_date: sessionParameters.appointment_date || null,
        appointment_time: sessionParameters.appointment_time || null,
        whatsapp_phone: phoneDigitsOnly(fromPhone)
    };
    const bookingReady = Boolean(
        bookingPayload.patient_name &&
        bookingPayload.appointment_date &&
        bookingPayload.appointment_time
    );

    return {
        success: true,
        session,
        replyTexts: extractDialogflowTextResponses(queryResult),
        sessionParameters,
        bookingReady,
        bookingPayload: bookingReady ? bookingPayload : null,
        rawResponse: response
    };
};

const handleDialogflowCxWhatsAppMessage = async ({ payload, message, languageCode = 'hi', sendReplies = false }) => {
    const inboundMessages = message ? [message] : extractWhatsAppInboundTextMessages(payload);
    const results = [];

    for (const inbound of inboundMessages) {
        try {
            const dialogflowResult = await runDialogflowCxForWhatsAppMessage({
                fromPhone: inbound.fromPhone,
                text: inbound.text,
                languageCode
            });

            const result = {
                ...inbound,
                dialogflow: dialogflowResult,
                replyTexts: dialogflowResult.replyTexts,
                bookingReady: dialogflowResult.bookingReady,
                bookingPayload: dialogflowResult.bookingPayload,
                metaReplies: []
            };

            if (sendReplies) {
                for (const replyText of dialogflowResult.replyTexts) {
                    try {
                        const metaReply = await sendDialogflowWhatsAppTextReply({
                            toPhone: inbound.fromPhone,
                            text: replyText,
                            phoneNumberId: inbound.phoneNumberId,
                            businessAccountId: inbound.businessAccountId
                        });
                        result.metaReplies.push({ success: true, response: metaReply });
                    } catch (sendError) {
                        console.error('[YogiDesk Debug] Meta reply send failed:', {
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
            }

            results.push(result);
        } catch (error) {
            console.error('Dialogflow CX WhatsApp runtime failed:', {
                messageId: inbound.messageId,
                fromPhone: inbound.fromPhone,
                error: error.message || error
            });

            results.push({
                ...inbound,
                dialogflow: { success: false, error: error.message || 'Dialogflow CX runtime failed.' },
                replyTexts: [],
                bookingReady: false,
                bookingPayload: null
            });
        }
    }

    return results;
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
exports.runDialogflowCxForWhatsAppMessage = runDialogflowCxForWhatsAppMessage;
exports.handleDialogflowCxWhatsAppMessage = handleDialogflowCxWhatsAppMessage;
exports.sendDialogflowWhatsAppTextReply = sendDialogflowWhatsAppTextReply;
