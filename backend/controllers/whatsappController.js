require('dotenv').config();
const axios = require('axios');
const { supabase, supabaseAdmin } = require('../config/supabase');

const missingSubAccountConfigResponse = {
    success: false,
    message: "WhatsApp API profile configuration missing for this sub-account."
};

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

const buildCampaignQueuePayload = ({ userId, doctorId: requestDoctorId, template = {}, recipient = {}, scheduledFor }) => {
    const doctorId = requestDoctorId || userId || template.doctor_id || template.user_id || null;
    const resolvedUserId = userId || requestDoctorId || template.user_id || template.doctor_id || null;
    return {
        user_id: resolvedUserId,
        doctor_id: doctorId,
        template_id: template.id || null,
        template_name: template.template_name || template.name || 'WhatsApp Template',
        template_category: template.category || 'UTILITY',
        language: template.language || 'en_US',
        recipient_name: String(recipient.name || '').trim(),
        recipient_phone: String(recipient.phone || '').trim(),
        phone: String(recipient.phone || '').trim(),
        payload: { template, recipient },
        status: 'PENDING',
        scheduled_for: scheduledFor
    };
};

const buildMinimalCampaignQueuePayload = (row = {}) => ({
    template_name: row.template_name || row.payload?.template?.template_name || row.payload?.template?.name || 'WhatsApp Template',
    status: row.status || 'PENDING',
    doctor_id: row.doctor_id || row.user_id || null,
    user_id: row.user_id || row.doctor_id || null,
    language: row.language || row.payload?.template?.language || 'en_US',
    recipient_phone: row.recipient_phone || row.phone || row.payload?.recipient?.phone || ''
});

const buildQueuedInboxChatPayload = ({ userId, doctorId: requestDoctorId, template = {}, recipient = {}, scheduledFor }) => {
    const doctorId = requestDoctorId || userId || template.doctor_id || template.user_id || null;
    const resolvedUserId = userId || requestDoctorId || template.user_id || template.doctor_id || null;
    const recipientName = String(recipient.name || '').trim() || 'Unknown Patient';
    const recipientPhone = String(recipient.phone || '').trim();
    return {
        user_id: resolvedUserId,
        doctor_id: doctorId,
        name: recipientName,
        patient_name: recipientName,
        phone: recipientPhone,
        last_message: `Queued: ${template.template_name || template.name || 'WhatsApp Template'}`,
        status: 'QUEUED',
        scheduled_at: scheduledFor,
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
        console.error("Campaign Queue Insert Error:", error.message);
        if (isSchemaCacheError(error)) {
            console.error("Supabase Cached Schema Crash:", error.message);
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
                console.error("Supabase Cached Schema Crash:", fallbackError.message);
            }
            return { inserted: false, fallbackRequired: true, error };
        }

        throw error;
    }
};

const insertQueuedInboxChatRows = async ({ rows = [] }) => {
    if (!supabase?.from || !Array.isArray(rows) || rows.length === 0) return { inserted: false };

    const fallbackRows = rows.map((row) => ({
        name: row.name,
        phone: row.phone,
        status: row.status,
        doctor_id: row.doctor_id || row.user_id || null
    }));
    const minimalRows = rows.map((row) => ({
        name: row.name || row.patient_name,
        phone: row.phone,
        status: row.status,
        doctor_id: row.doctor_id || row.user_id || null
    }));

    try {
        const { error } = await supabase.from('inbox_chats').insert(fallbackRows);
        if (error) throw error;
        return { inserted: true };
    } catch (error) {
        logInboxDatabaseError(error);
        try {
            const { error: fallbackError } = await supabase.from('inbox_chats').insert(fallbackRows);
            if (fallbackError) throw fallbackError;
            return { inserted: true };
        } catch (fallbackError) {
            logInboxDatabaseError(fallbackError);
            try {
                const { error: minimalError } = await supabase.from('inbox_chats').insert(minimalRows);
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
    let data = null;
    let lastError = null;

    for (const column of lookupColumns) {
        let result = await supabase
            .from('doctor_profiles')
            .select('whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token')
            .eq(column, doctorId)
            .maybeSingle();

        if (result.error) {
            const message = String(result.error?.message || result.error?.details || '').toLowerCase();
            const isMissingColumn = result.error?.code === '42703' || result.error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
            if (isMissingColumn) {
                result = await supabase
                    .from('doctor_profiles')
                    .select('meta_phone_number_id,meta_waba_id,system_user_token')
                    .eq(column, doctorId)
                    .maybeSingle();
            }
        }

        if (result.data) {
            data = result.data;
            lastError = null;
            break;
        }

        if (result.error) {
            lastError = result.error;
        }
    }

    if (lastError || !data) {
        if (lastError) console.warn('Meta credential lookup failed:', lastError.message);
        return {};
    }

    return {
        phoneNumberId: data.whatsapp_phone_number_id || data.meta_phone_number_id || null,
        businessAccountId: data.whatsapp_business_account_id || data.meta_waba_id || null,
        accessToken: data.whatsapp_access_token || data.system_user_token || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null
    };
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
            name,
            email
        } = req.body;
        
        const phoneNumberId = String(whatsappPhoneNumberId || '').trim();
        const businessAccountId = String(whatsappWabaId || whatsappBusinessAccountId || '').trim();
        const accessToken = String(whatsappAccessToken || '').trim();

        if (!phoneNumberId || !businessAccountId || !accessToken) {
            return res.status(400).json({ success: false, message: "Invalid Meta configuration. All credentials are required." });
        }

        const isValid = await validateMetaCredentials({ phoneNumberId, businessAccountId, accessToken });
        if (!isValid) {
            return res.status(400).json({ success: false, message: "Invalid Meta configuration or access token permissions." });
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

        const client = supabaseAdmin || supabase;
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

        return res.status(200).json({ success: true, message: "Connection configurations saved securely." });
    } catch (error) {
        console.error('Meta save failure:', error.message);
        return res.status(500).json({ success: false, message: "Internal Server Error during configuration save." });
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
        res.status(200).json({ 
            success: true, 
            msg: "Message sent successfully!", 
            data: response.data 
        });

    } catch (error) {
        console.error("WhatsApp Error:", error.response ? error.response.data : error.message);
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
            error: error.response ? error.response.data : error.message 
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
        console.error("Meta Absolute Array Failure:", JSON.stringify(error.response?.data || error.message));
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
            error: error.response ? error.response.data : error.message
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
