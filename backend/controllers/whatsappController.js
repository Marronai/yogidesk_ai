require('dotenv').config();
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
    const templateText = template.templateText || template.bodyText || template.body_content || template.text || '';
    const recipientPhone = String(recipient.patientPhone || recipient.phone || recipient.recipient_phone || '').trim();
    const scheduledIso = resolveScheduledIso(scheduledFor, index);
    return {
        user_id: resolvedUserId,
        doctor_id: doctorId,
        template_id: template.id || null,
        template_name: template.template_name || template.name || 'WhatsApp Template',
        template_category: template.category || 'UTILITY',
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
    message_body: row.message_body || row.payload?.text || row.payload?.template?.templateText || row.payload?.template?.bodyText || row.payload?.template?.body_content || '',
    payload: {
        variables: row.payload?.variables || row.payload?.template?.variables || row.payload?.template?.variablesData || {},
        text: row.payload?.text || row.payload?.template?.templateText || row.payload?.template?.bodyText || row.payload?.template?.body_content || ''
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
        scheduled_at: scheduledIso,
        updated_at: new Date().toISOString(),
        metadata: {
            template_id: template.id || null,
            template_name: template.template_name || template.name || 'WhatsApp Template',
            template_category: template.category || 'UTILITY',
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
    const credentialLookups = [
        {
            select: 'meta_phone_number_id,meta_waba_id,system_user_token',
            map: (row) => ({
                phoneNumberId: row?.meta_phone_number_id || null,
                businessAccountId: row?.meta_waba_id || null,
                accessToken: row?.system_user_token || null
            })
        },
        {
            select: 'whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token',
            map: (row) => ({
                phoneNumberId: row?.whatsapp_phone_number_id || null,
                businessAccountId: row?.whatsapp_business_account_id || null,
                accessToken: row?.whatsapp_access_token || null
            })
        }
    ];
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
    const lookups = [
        'meta_phone_number_id,meta_waba_id,system_user_token',
        'whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token'
    ];

    for (const selectColumns of lookups) {
        const result = await client
            .from('doctor_profiles')
            .select(selectColumns)
            .eq('id', userId)
            .maybeSingle();

        if (!result.error) return result.data || {};
        if (!isMissingColumnError(result.error)) throw result.error;
    }

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

        console.log("Message Sent ID:", response.data.messages[0].id);

        // --- REAL-TIME INBOX LOGGING ---
        try {
            const activePhone = String(req.body.patientPhone || req.body.phone || req.body.phoneNumber || '').replace(/\D/g, '');
            const activeName = req.body.patientName || req.body.name || 'Patient';

            // 1. Upsert into inbox_chats so the row definitely exists
            const { data: chatRow, error: chatError } = await supabase
                .from('inbox_chats')
                .upsert({
                    doctor_id: req.body.doctorId || req.body.userId || doctorId,
                    phone: activePhone,
                    patient_phone: activePhone,
                    name: activeName,
                    patient_name: activeName,
                    last_message: req.body.templateText || 'Template Sent',
                    status: 'SENT',
                    unread_count: 0,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'phone' })
                .select()
                .single();

            // 2. Insert the outbound message directly into inbox_messages
            const absoluteMessageRow = {
                chat_id: chatRow?.id,
                body: req.body.templateText || `Template: ${req.body.templateName || 'hello_world'}`,
                text: req.body.templateText || `Template: ${req.body.templateName || 'hello_world'}`,
                message_body: req.body.templateText || `Template: ${req.body.templateName || 'hello_world'}`,
                sender: 'doctor',
                from_me: true,
                type: 'template',
                created_at: new Date().toISOString()
            };
            await supabase.from('inbox_messages').insert(absoluteMessageRow);
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
