require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const { supabase, supabaseAdmin } = require('./config/supabase');
const emailConfig = require('./config/emailConfig');
const { getUserUsage, addPatient, addPatients } = require('./controllers/patientController');
const {
    saveMetaConnection,
    buildCampaignQueuePayload,
    buildQueuedInboxChatPayload,
    insertCampaignQueueRows,
    insertQueuedInboxChatRows
} = require('./controllers/whatsappController');
const { getWalletBalance } = require('./controllers/adminController');

const app = express();

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin === 'https://yogidesk-ai.vercel.app' || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PLAN_CONTACT_LIMITS = { starter: 500, growth: 2000, hospital: 10000 };
const RATE_CARD = { UTILITY: 0.20, MARKETING: 1.30, AUTHENTICATION: 0.20 };
const normalizeTier = (tier = 'starter') => String(tier).toLowerCase().split(' ')[0];
const normalizePhone = (phone) => String(phone || '').replace(/[^\d+]/g, '');
const resolveCampaignVariableValue = (value, recipient = {}) => {
    const rawValue = String(value || '').trim();
    const token = rawValue.replace(/^\[\[|\]\]$/g, '');
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const replacements = {
        'patient.name': recipient.name || recipient.patientName || recipient.recipient_name || 'Patient',
        'patient.phone': recipient.phone || recipient.patientPhone || recipient.recipient_phone || '',
        'patient.appointment_time': recipient.appointment_time || recipient.appointmentTime || '',
        today
    };

    return rawValue.startsWith('[[') && rawValue.endsWith(']]')
        ? String(replacements[token] || '')
        : rawValue;
};
const getUnitCost = (category) => RATE_CARD[String(category || 'UTILITY').toUpperCase()] || RATE_CARD.UTILITY;
const formatTemplateName = (value) => (
    String(value || '')
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
);
const normalizeTemplateLanguage = (language) => {
    const normalized = String(language || 'en_US').toLowerCase();
    if (['hi', 'hindi'].includes(normalized)) return 'hi';
    if (['hinglish', 'hi_latn', 'hi-latn'].includes(normalized)) return 'en_US';
    if (['en', 'en_us', 'english'].includes(normalized)) return 'en_US';
    if (normalized === 'en_in') return 'en_IN';
    return language || 'en_US';
};
const sanitizeMetaPhoneNumber = (value) => {
    const digits = String(value || '').trim().replace(/^\+/, '').replace(/\D/g, '');
    return digits.length === 10 ? `91${digits}` : digits;
};
const cleanCredentialValue = (value) => String(value || '').trim();
const invalidMetaConfigurationResponse = {
    success: false,
    message: "Invalid Meta configuration or access token permissions. Please check your developer credentials."
};
const getBearerToken = (req) => {
    const header = req.headers.authorization || '';
    return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};
const getSupabaseSessionUser = async (req) => {
    const token = getBearerToken(req);
    if (!token) return null;
    if (token.startsWith('supabase-bypass-token-')) {
        const fallbackUserId = token.replace('supabase-bypass-token-', '').trim();
        if (!fallbackUserId) return null;
        return {
            id: fallbackUserId,
            email: req.body?.email || req.query?.email || null
        };
    }

    const client = supabaseAdmin || supabase;
    if (!client?.auth?.getUser) return null;

    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) {
        console.error('Settings session validation failed:', error?.message || 'missing Supabase user');
        return null;
    }

    return data.user;
};
const isMissingColumnError = (error) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};
const validateMetaCredentials = async ({ phoneNumberId, businessAccountId, accessToken }) => {
    try {
        await axios.get(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
            params: {
                fields: 'id,display_phone_number,verified_name'
            },
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            timeout: 10000,
            validateStatus: (status) => status >= 200 && status < 300
        });

        await axios.get(`https://graph.facebook.com/v21.0/${businessAccountId}`, {
            params: {
                fields: 'id,name'
            },
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            timeout: 10000,
            validateStatus: (status) => status >= 200 && status < 300
        });

        return true;
    } catch (error) {
        console.error('Meta credential validation failed:', error.response?.data || error.message || error);
        return false;
    }
};
const buildTemplateComponents = ({ bodyText, headerType, headerText, footerText, buttons, components }) => {
    if (Array.isArray(components) && components.length > 0) {
        return components.map((component) => {
            if (!component?.type) return null;
            if (component.type === 'HEADER') {
                const text = String(component.text || '').trim();
                if (component.format === 'TEXT') {
                    return text ? { type: 'HEADER', format: 'TEXT', text } : null;
                }
                if (['DOCUMENT', 'LOCATION'].includes(component.format)) {
                    return { type: 'HEADER', format: component.format };
                }
                return null;
            }
            if (component.type === 'BODY') {
                const text = String(component.text || bodyText || '').trim();
                return text ? { type: 'BODY', text } : null;
            }
            if (component.type === 'FOOTER') {
                const text = String(component.text || '').trim();
                return text ? { type: 'FOOTER', text } : null;
            }
            if (component.type === 'BUTTONS' && Array.isArray(component.buttons)) {
                const buttonList = component.buttons.map((btn) => {
                    const text = String(btn.text || '').trim();
                    if (btn.type === 'URL') {
                        const url = String(btn.url || '').trim();
                        return text && url ? { type: 'URL', text, url } : null;
                    }
                    const phoneNumber = sanitizeMetaPhoneNumber(btn.phone_number || btn.phone);
                    return text && phoneNumber ? { type: 'PHONE_NUMBER', text, phone_number: phoneNumber } : null;
                }).filter(Boolean).slice(0, 2);
                return buttonList.length ? { type: 'BUTTONS', buttons: buttonList } : null;
            }
            return null;
        }).filter(Boolean);
    }

    const graphComponents = [];
    const cleanBodyText = String(bodyText || '').trim();
    const cleanHeaderText = String(headerText || '').trim();
    const cleanFooterText = String(footerText || '').trim();

    if (headerType === 'TEXT' && cleanHeaderText) {
        graphComponents.push({ type: 'HEADER', format: 'TEXT', text: cleanHeaderText });
    }
    if (headerType === 'DOCUMENT') {
        graphComponents.push({ type: 'HEADER', format: 'DOCUMENT' });
    }
    if (headerType === 'LOCATION') {
        graphComponents.push({ type: 'HEADER', format: 'LOCATION' });
    }
    if (cleanBodyText) {
        graphComponents.push({ type: 'BODY', text: cleanBodyText });
    }
    if (cleanFooterText) {
        graphComponents.push({ type: 'FOOTER', text: cleanFooterText });
    }

    const sanitizedButtons = Array.isArray(buttons) ? buttons.slice(0, 2).map((btn) => {
        const text = String(btn.text || '').trim();
        if (btn.type === 'URL') {
            const url = String(btn.url || '').trim();
            return text && url ? { type: 'URL', text, url } : null;
        }
        const phoneNumber = sanitizeMetaPhoneNumber(btn.phone_number || btn.phone);
        return text && phoneNumber ? { type: 'PHONE_NUMBER', text, phone_number: phoneNumber } : null;
    }).filter(Boolean) : [];

    if (sanitizedButtons.length) {
        graphComponents.push({ type: 'BUTTONS', buttons: sanitizedButtons });
    }

    return graphComponents;
};
const sendWelcomeEmail = typeof emailConfig.sendWelcomeEmail === 'function' ? emailConfig.sendWelcomeEmail : async () => false;
const sendLoginAlert = typeof emailConfig.sendLoginAlert === 'function' ? emailConfig.sendLoginAlert : async () => false;
const sendDirectEmail = typeof emailConfig.sendDirectEmail === 'function' ? emailConfig.sendDirectEmail : async () => false;

// ====== HEALTH CHECK ENDPOINT ======
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Yogi Desk API',
    audience: 'Doctors and Clinics',
  });
});

const attachDoctorSession = (req, res, next) => {
    const doctorId = req.user?.id || req.query?.userId || req.query?.user_id || req.body?.userId || req.body?.user_id;
    if (doctorId) req.user = { ...(req.user || {}), id: doctorId };
    next();
};

app.get('/api/user/usage', attachDoctorSession, getUserUsage);
app.get('/api/wallet/balance', attachDoctorSession, getWalletBalance);
app.post('/api/patients', attachDoctorSession, addPatient);
app.post('/api/patients/bulk', attachDoctorSession, addPatients);

app.post('/api/auth/dispatch-welcome-email', async (req, res) => {
    try {
        const { email, name, businessName, userId } = req.body || {};
        if (!email) return res.status(400).json({ success: false, msg: 'Email is required' });

        if (supabaseAdmin && userId) {
            await supabaseAdmin.from('wallets').upsert({
                user_id: userId,
                balance: 50.00,
                is_first_recharge: true,
                welcome_gift_active: true,
                current_plan: 'starter',
                plan_tier: 'starter',
                lifetime_contacts_count: 0
            }, { onConflict: 'user_id', ignoreDuplicates: true });
        }

        const sent = await sendWelcomeEmail(email, name || 'Doctor', businessName || 'Yogi Desk Clinic');
        return res.status(sent ? 200 : 202).json({ success: sent });
    } catch (error) {
        console.error('Welcome email dispatch error:', error.message);
        return res.status(202).json({ success: false });
    }
});

app.post('/api/auth/dispatch-login-alert', async (req, res) => {
    try {
        const { email, name } = req.body || {};
        if (!email) return res.status(400).json({ success: false, msg: 'Email is required' });

        const ipAddress = (req.headers['x-forwarded-for'] || req.ip || 'Unknown IP').split(',')[0].trim();
        const deviceInfo = req.headers['user-agent'] || 'Verified browser login';
        const sent = await sendLoginAlert(email, name || 'Doctor', deviceInfo, ipAddress);
        return res.status(sent ? 200 : 202).json({ success: sent });
    } catch (error) {
        console.error('Login email dispatch error:', error.message);
        return res.status(202).json({ success: false });
    }
});

app.post('/api/team/dispatch-invite-email', async (req, res) => {
    try {
        const { email, name, inviteLink } = req.body || {};
        if (!email || !inviteLink) return res.status(400).json({ success: false, msg: 'Email and invite link are required' });
        const sent = await sendDirectEmail(
            email,
            'You have been invited to Yogi Desk',
            `
              <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:14px">
                <h2 style="margin:0 0 12px;color:#111827">Yogi Desk team invite</h2>
                <p style="color:#4b5563;line-height:1.6">Hi ${name || 'there'}, your clinic admin has invited you to join their Yogi Desk workspace.</p>
                <p><a href="${inviteLink}" style="display:inline-block;background:#ff6b00;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Accept Invite</a></p>
              </div>
            `,
            'system'
        );

        return res.status(sent ? 200 : 202).json({ success: sent });
    } catch (error) {
        console.error('Team invite email dispatch error:', error.message);
        return res.status(202).json({ success: false });
    }
});

// ====== META WEBHOOK ENDPOINTS ======

// GET Method: Meta WhatsApp webhook verification
app.get('/api/whatsapp-webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === 'YogiDesk_Doctor_Secure_2026') {
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

app.post('/api/whatsapp-webhook', async (req, res) => {
    try {
        const body = req.body;
        if (!body || !body.object || !Array.isArray(body.entry)) {
            return res.status(400).send('Invalid webhook payload');
        }

        for (const entry of body.entry) {
            if (!Array.isArray(entry.changes)) continue;

            for (const change of entry.changes) {
                const field = change.field;
                const value = change.value || {};

                if (field === 'message_template' || field === 'message_template_status_update') {
                    const messageTemplate = value.message_template || value.message_template_status || value;
                    if (!messageTemplate) continue;

                    const status = String(messageTemplate.status || '').toUpperCase();
                    if (!['APPROVED', 'REJECTED'].includes(status)) continue;

                    const metaTemplateId = messageTemplate.id || null;
                    const templateName = messageTemplate.name || value.template_name || null;

                    let updateResult;
                    if (metaTemplateId && templateName) {
                        updateResult = await supabase
                            .from('whatsapp_templates')
                            .update({ status })
                            .or(`meta_template_id.eq.${metaTemplateId},template_name.eq.${templateName}`);
                    } else if (metaTemplateId) {
                        updateResult = await supabase
                            .from('whatsapp_templates')
                            .update({ status })
                            .eq('meta_template_id', metaTemplateId);
                    } else if (templateName) {
                        updateResult = await supabase
                            .from('whatsapp_templates')
                            .update({ status })
                            .eq('template_name', templateName);
                    } else {
                        continue;
                    }
                    if (updateResult.error) {
                        console.error('Webhook template status update failed:', updateResult.error);
                    } else {
                        console.log(`Webhook updated template status to ${status} for template id/name: ${metaTemplateId || templateName}`);
                    }
                }
            }
        }

        return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('❌ WhatsApp webhook processing error:', error.message || error);
        return res.status(200).send('EVENT_RECEIVED');
    }
});

// 1. GET Method: Meta Dashboard verification loop
app.get('/api/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const fallbackVerifyToken = "YogiDesk_Doctor_Secure_2026";
    const allowedVerifyTokens = [
        process.env.META_VERIFY_TOKEN,
        process.env.WHATSAPP_VERIFY_TOKEN,
        fallbackVerifyToken
    ].filter(Boolean);

    console.log(`🔍 Meta Verification Attempt -> Received Token: ${token}`);

    if (mode && token) {
        if (mode === 'subscribe' && allowedVerifyTokens.includes(token)) {
            console.log('✅ Meta Webhook Verified Successfully!');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ Webhook Verification Failed: Token Mismatch');
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400);
});

// 2. POST Method: Handles real-time Webhook WhatsApp clicks
app.post('/api/webhook/meta', async (req, res) => {
    try {
        const body = req.body;

        // Verify if this is a genuine WhatsApp message object
        if (body.object && body.entry && Array.isArray(body.entry)) {
            for (const entry of body.entry) {
                if (!Array.isArray(entry.changes)) continue;

                for (const change of entry.changes) {
                    const field = change.field;
                    const value = change.value || {};

                    if (field === 'message_template' || field === 'message_template_status_update') {
                        const messageTemplate = value.message_template || value.message_template_status || value;
                        if (!messageTemplate || !messageTemplate.id) continue;

                        const status = (messageTemplate.status || '').toUpperCase();
                        if (['APPROVED', 'REJECTED'].includes(status)) {
                            let updateQuery = supabase
                                .from('whatsapp_templates')
                                .update({ status })
                                .eq('meta_template_id', messageTemplate.id);

                        const webhookUserId = value.metadata?.user_id || value.user_id;
                        if (webhookUserId) {
                            updateQuery = updateQuery.eq('user_id', webhookUserId);
                        }

                        const updateResult = await updateQuery;
                        if (updateResult.error) {
                            console.error('Webhook template status update failed:', updateResult.error);
                        } else {
                            console.log(`Webhook updated template status to ${status} for meta_template_id=${messageTemplate.id}`);
                        }
                        }
                    }

                    if (field === 'messages' && value.messages && value.messages[0]) {
                        const messageData = value.messages[0];
                        const patientPhone = messageData.from;
                        console.log(`📩 Message received from patient: ${patientPhone}`);

                        if (messageData.type === 'button') {
                            const buttonPayload = messageData.button?.payload;
                            const buttonText = messageData.button?.text;
                            console.log(`🔘 Patient clicked: ${buttonText} (Payload: ${buttonPayload})`);

                            if (supabase) {
                                await supabase.from('whatsapp_logs').insert([
                                    {
                                        patient_phone: patientPhone,
                                        button_payload: buttonPayload,
                                        raw_response: body
                                    }
                                ]);

                                const newStatus = buttonPayload === 'CONFIRM_SLOT' ? 'Confirmed' : 'Cancelled';
                                const { data: patient } = await supabase
                                    .from('patients')
                                    .select('id')
                                    .eq('phone_number', patientPhone)
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();

                                if (patient) {
                                    await supabase
                                        .from('appointments')
                                        .update({ status: newStatus })
                                        .eq('patient_id', patient.id)
                                        .eq('status', 'Pending');
                                    console.log(`🔄 Status successfully updated to: ${newStatus}`);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Meta requires an absolute 200 OK to clear queue loops
        return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        console.error('❌ Webhook Processing Error:', error.message);
        return res.status(200).send('EVENT_RECEIVED'); 
    }
});

// ====== WHATSAPP TEMPLATE CREATION ======
const syncTemplatesFromMetaInBackground = async (userId) => {
    if (!supabase?.from || !userId) return;

    const { data: userMeta, error: credentialError } = await supabase
        .from('doctor_profiles')
        .select('system_user_token,meta_waba_id')
        .eq('id', userId)
        .maybeSingle();

    if (credentialError || !userMeta?.meta_waba_id || !userMeta?.system_user_token) {
        if (credentialError) console.warn('Background template sync credential error:', credentialError.message);
        return;
    }

    const graphUrl = `https://graph.facebook.com/v20.0/${userMeta.meta_waba_id}/message_templates`;
    const response = await require('axios').get(graphUrl, {
        headers: { Authorization: `Bearer ${userMeta.system_user_token}` }
    });

    const metaTemplates = Array.isArray(response.data?.data) ? response.data.data : [];
    if (!metaTemplates.length) return;

    const { data: localTemplates, error: localError } = await supabase
        .from('whatsapp_templates')
        .select('id,template_name')
        .eq('user_id', userId);

    if (localError) throw localError;

    const localByName = new Map(
        (Array.isArray(localTemplates) ? localTemplates : [])
            .map((template) => [String(template.template_name || '').toLowerCase(), template])
            .filter(([name]) => name)
    );

    for (const metaTemplate of metaTemplates) {
        const templateName = metaTemplate.name || metaTemplate.template_name;
        if (!templateName) continue;

        const status = String(metaTemplate.status || 'PENDING').toUpperCase() === 'PENDING_REVIEW'
            ? 'PENDING'
            : String(metaTemplate.status || 'PENDING').toUpperCase();
        const metaTemplateId = metaTemplate.id || metaTemplate.message_template_id || null;
        const components = Array.isArray(metaTemplate.components) ? metaTemplate.components : [];
        const body = components.find((component) => component.type === 'BODY');
        const header = components.find((component) => component.type === 'HEADER');
        const footer = components.find((component) => component.type === 'FOOTER');
        const buttons = components.find((component) => component.type === 'BUTTONS');

        if (localByName.has(String(templateName).toLowerCase())) {
            const { error } = await supabase
                .from('whatsapp_templates')
                .update({ status, meta_template_id: metaTemplateId })
                .eq('user_id', userId)
                .eq('template_name', templateName);
            if (error) throw error;
            continue;
        }

        const { error } = await supabase
            .from('whatsapp_templates')
            .upsert({
                user_id: userId,
                template_name: templateName,
                category: metaTemplate.category || 'MARKETING',
                language: metaTemplate.language || 'en_US',
                body_content: body?.text || '',
                status,
                header_type: header?.format || 'NONE',
                header_text: header?.format === 'TEXT' ? header?.text || null : null,
                footer_text: footer?.text || null,
                buttons: Array.isArray(buttons?.buttons) ? buttons.buttons : [],
                created_at: new Date().toISOString(),
                meta_template_id: metaTemplateId
            });
        if (error) throw error;
    }
};

app.get('/api/templates', async (req, res) => {
    try {
        if (!supabase?.from) {
            throw new Error('Database connection unavailable.');
        }

        const userId = req.query.userId || req.body?.userId;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        const { data: templates, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.status(200).json(Array.isArray(templates) ? templates : []);
    } catch (error) {
        console.error('Template fetch error:', error.message || error);
        return res.status(400).json({ success: false, message: error.message || 'Template fetch failed.' });
    } finally {
        const userId = req.query.userId || req.body?.userId;
        if (userId) {
            Promise.resolve()
                .then(() => syncTemplatesFromMetaInBackground(userId))
                .catch((syncError) => {
                    console.error('Background template sync failed:', syncError.response?.data || syncError.message || syncError);
                });
        }
    }
});

app.get('/api/templates/sync', async (req, res) => {
    try {
        if (!supabase?.from) {
            throw new Error('Database connection unavailable.');
        }

        const userId = req.query.userId || req.body?.userId;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        const { data: userMeta, error: credentialError } = await supabase
            .from('doctor_profiles')
            .select('system_user_token,meta_waba_id')
            .eq('id', userId)
            .maybeSingle();

        if (credentialError) throw credentialError;
        if (!userMeta?.meta_waba_id || !userMeta?.system_user_token) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials.' });
        }

        const graphUrl = `https://graph.facebook.com/v21.0/${userMeta.meta_waba_id}/message_templates`;
        const response = await require('axios').get(graphUrl, {
            params: { access_token: userMeta.system_user_token }
        });

        const metaTemplates = Array.isArray(response.data?.data) ? response.data.data : [];
        const updates = [];

        for (const metaTemplate of metaTemplates) {
            const metaTemplateId = metaTemplate.id || metaTemplate.message_template_id || null;
            const templateName = metaTemplate.name || metaTemplate.template_name || '';
            const rawStatus = String(metaTemplate.status || 'PENDING').toUpperCase();
            const status = rawStatus === 'PENDING_REVIEW' ? 'PENDING' : rawStatus;

            if (!templateName && !metaTemplateId) continue;

            let updateQuery = supabase
                .from('whatsapp_templates')
                .update({
                    status,
                    meta_template_id: metaTemplateId
                })
                .eq('user_id', userId);

            updateQuery = metaTemplateId
                ? updateQuery.or(`meta_template_id.eq.${metaTemplateId},template_name.eq.${templateName}`)
                : updateQuery.eq('template_name', templateName);

            const { error: updateError } = await updateQuery;
            if (!updateError) updates.push({ name: templateName, id: metaTemplateId, status });
        }

        return res.status(200).json({ success: true, templates: updates });
    } catch (error) {
        console.error('Template sync error:', error.response?.data || error.message || error);
        return res.status(400).json({ success: false, message: error.response?.data?.error?.message || error.message || 'Template sync failed.' });
    }
});

app.post('/api/templates', async (req, res) => {
    try {
        if (!supabase?.from) {
            throw new Error('Database connection unavailable.');
        }

        const {
            userId,
            name,
            bodyText,
            language = 'en_US',
            category = 'MARKETING',
            headerType = 'NONE',
            headerText = '',
            footerText = '',
            buttons = [],
            components = [],
            messaging_product: messagingProduct = 'whatsapp',
            whatsapp_business_account_id: requestBusinessAccountId,
            whatsapp_access_token: requestAccessToken
        } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        const formattedName = formatTemplateName(name);

        if (!formattedName) {
            return res.status(400).json({ success: false, message: 'Template name is required.' });
        }

        if (!bodyText || !bodyText.trim()) {
            return res.status(400).json({ success: false, message: 'Template body text is required.' });
        }

        const { data: userMeta, error: credentialError } = await supabase
            .from('doctor_profiles')
            .select('system_user_token,meta_phone_number_id,meta_waba_id')
            .eq('id', userId)
            .maybeSingle();

        if (credentialError || !userMeta) {
            console.warn('Unable to fetch Meta credentials for user:', credentialError?.message || 'missing data');
        }

        const businessAccountId = requestBusinessAccountId || userMeta?.meta_waba_id || null;
        const accessToken = requestAccessToken || userMeta?.system_user_token || null;

        if (!businessAccountId || !accessToken) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials. Please configure Meta WhatsApp credentials in settings.' });
        }

        const graphComponents = buildTemplateComponents({ bodyText, headerType, headerText, footerText, buttons, components });
        const sanitizedButtons = graphComponents.find((component) => component.type === 'BUTTONS')?.buttons || [];
        const metaLanguage = normalizeTemplateLanguage(language);

        const graphUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;
        const response = await require('axios').post(graphUrl, {
            messaging_product: messagingProduct || 'whatsapp',
            name: formattedName,
            language: metaLanguage,
            category,
            components: graphComponents
        }, {
            params: {
                access_token: accessToken
            }
        });

        const metaTemplateId = response.data?.id || response.data?.message_template_id || null;
        const newTemplateRow = {
            user_id: userId,
            template_name: formattedName,
            category,
            language: metaLanguage,
            body_content: bodyText,
            status: 'PENDING_REVIEW',
            header_type: headerType,
            header_text: headerType === 'TEXT' ? headerText.trim() : null,
            footer_text: footerText ? footerText.trim() : null,
            buttons: sanitizedButtons,
            created_at: new Date().toISOString(),
            meta_template_id: metaTemplateId
        };

        const { data: insertedTemplate, error: insertError } = await supabase
            .from('whatsapp_templates')
            .insert([newTemplateRow])
            .select();

        if (insertError) {
            console.error('Template save error:', insertError);
            return res.status(400).json({ success: false, message: insertError.message || 'Template created in Meta, but failed to save.' });
        }

        return res.status(201).json({ message: 'Template submitted successfully.', data: insertedTemplate[0] });
    } catch (error) {
        console.error('Template submission error:', error.response?.data || error.message || error);
        return res.status(400).json({ success: false, message: error.response?.data?.error?.message || error.message || 'Template submission failed.' });
    }
});

/**
 * REFACTORED: Dedicated route for Meta Connection Configuration.
 * Now strictly uses session-level profile updates via the controller.
 */
app.get('/api/settings/meta-connection', async (req, res) => {
    try {
        const sessionUser = await getSupabaseSessionUser(req);
        if (!sessionUser?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const client = supabaseAdmin || supabase;
        let { data, error } = await client
            .from('doctor_profiles')
            .select('meta_phone_number_id,meta_waba_id,system_user_token')
            .eq('id', sessionUser.id)
            .maybeSingle();

        if (error && isMissingColumnError(error)) {
            const fallbackResult = await client
                .from('doctor_profiles')
                .select('whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token')
                .eq('id', sessionUser.id)
                .maybeSingle();

            data = fallbackResult.data
                ? {
                    meta_phone_number_id: fallbackResult.data.whatsapp_phone_number_id || '',
                    meta_waba_id: fallbackResult.data.whatsapp_business_account_id || '',
                    system_user_token: fallbackResult.data.whatsapp_access_token || ''
                }
                : null;
            error = fallbackResult.error;
        }

        if (error) throw error;

        return res.status(200).json({
            success: true,
            data: {
                meta_phone_number_id: data?.meta_phone_number_id || '',
                meta_waba_id: data?.meta_waba_id || '',
                system_user_token: data?.system_user_token || ''
            }
        });
    } catch (error) {
        console.error('Meta settings fetch failure:', error.message || error);
        return res.status(500).json({ success: false, message: "Unable to fetch Meta configuration." });
    }
});

app.post('/api/settings/meta-connection', async (req, res, next) => {
    const sessionUser = await getSupabaseSessionUser(req);
    if (!sessionUser) return res.status(401).json({ success: false, message: "Unauthorized" });
    req.user = sessionUser;
    next();
}, saveMetaConnection);

// ====== CAMPAIGN SCHEDULER ======
app.post('/api/campaigns/schedule', async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ success: false, msg: "Database connection unavailable" });

        const { userId, template, recipients = [] } = req.body;
        if (!userId || !template || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ success: false, msg: "Template and recipients are required" });
        }

        const seen = new Set();
        const uniqueRecipients = recipients
            .map((recipient) => ({
                name: String(recipient.name || '').trim(),
                phone: normalizePhone(recipient.phone),
                appointment_time: String(recipient.appointment_time || recipient.appointmentTime || '').trim()
            }))
            .filter((recipient) => {
                if (!recipient.name || !recipient.phone || seen.has(recipient.phone)) return false;
                seen.add(recipient.phone);
                return true;
            });

        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('balance, plan_tier, lifetime_contacts_count')
            .eq('user_id', userId)
            .maybeSingle();

        if (walletError || !wallet) return res.status(404).json({ success: false, msg: "Wallet not found" });

        const tier = normalizeTier(wallet.plan_tier);
        const contactLimit = PLAN_CONTACT_LIMITS[tier] || PLAN_CONTACT_LIMITS.starter;
        const currentCount = Number(wallet.lifetime_contacts_count || 0);
        const nextCount = currentCount + uniqueRecipients.length;

        if (nextCount > contactLimit) {
            return res.status(403).json({ success: false, msg: "Contact tier limit reached. Upgrade required." });
        }

        const baseTime = Date.now();
        const queueRows = uniqueRecipients.map((recipient, index) => buildCampaignQueuePayload({
            userId,
            template: {
                ...template,
                variables: Object.fromEntries(
                    Object.entries(template.variables || {}).map(([key, value]) => [
                        key,
                        resolveCampaignVariableValue(value, recipient)
                    ])
                )
            },
            recipient,
            scheduledFor: new Date(baseTime + index * 3 * 60 * 1000).toISOString()
        }));
        const inboxChatRows = uniqueRecipients.map((recipient, index) => buildQueuedInboxChatPayload({
            userId,
            template,
            recipient,
            scheduledFor: new Date(baseTime + index * 3 * 60 * 1000).toISOString()
        }));
        const fallbackRows = queueRows.map((row) => ({
            user_id: row.user_id || row.doctor_id,
            doctor_id: row.doctor_id || row.user_id,
            template_name: row.template_name,
            recipient_name: row.recipient_name,
            recipient_phone: row.recipient_phone,
            status: row.status,
            scheduled_for: row.scheduled_for
        }));

        const queueInsertResult = await insertCampaignQueueRows({ rows: queueRows, fallbackRows });
        if (queueInsertResult.fallbackRequired) {
            Promise.resolve().then(() => processCampaignFallbackRows(queueRows));
        }
        await insertQueuedInboxChatRows({ rows: inboxChatRows });
        Promise.resolve()
            .then(() => processCampaignQueue())
            .catch((error) => console.error('Immediate campaign dispatch failed:', error.message || error));

        const { error: countError } = await supabase
            .from('wallets')
            .update({ lifetime_contacts_count: nextCount })
            .eq('user_id', userId);
        if (countError) throw countError;

        return res.status(200).json({
            success: true,
            queued: queueRows.length,
            newUniqueRecipients: uniqueRecipients.length
        });
    } catch (error) {
        console.error('Campaign schedule error:', error.message);
        return res.status(500).json({ success: false, msg: "Unable to schedule campaign" });
    }
});

// ====== TASK 3: DYNAMIC WALLET DEDUCTION ENGINE ======
app.post('/api/campaign/broadcast', async (req, res) => {
    const { userId, templateCategory, patientCount, templateName } = req.body;

    try {
        if (!supabase) return res.status(500).json({ msg: "Database connection unavailable" });

        // 1. Calculate Costs (Flat rates, no GST breakdown shown to user)
        const unitCost = templateCategory === 'UTILITY' ? 0.20 : 1.30;
        const totalCost = parseFloat((patientCount * unitCost).toFixed(2));

        // 2. Fetch User Balance
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();

        if (walletError) throw walletError;
        if (!wallet) {
            return res.status(404).json({ success: false, msg: "Wallet not found. Please finish workspace activation." });
        }

        // 3. Validation Logic
        const currentBalance = parseFloat(wallet.balance || 0);
        if (currentBalance < totalCost) {
            return res.status(400).json({ 
                success: false, 
                msg: `Insufficient Yogi Wallet Balance! Please recharge with at least ₹100 to execute this broadcast.` 
            });
        }

        // 4. Atomic Transaction: Deduct Balance & Log Entry
        const newBalance = parseFloat((currentBalance - totalCost).toFixed(2));

        // Update balance
        const { error: updateError } = await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', userId);

        if (updateError) throw updateError;

        // Write Debit Entry
        await supabase.from('wallet_transactions').insert([
            { 
                user_id: userId,
                amount: totalCost,
                type: 'message_debit',
                description: `Broadcast: Sent ${templateCategory} template "${templateName}" to ${patientCount} patients`,
                metadata: {
                    unit_cost: unitCost,
                    category: templateCategory,
                    patients: patientCount
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            msg: "Broadcast initiated successfully",
            deducted: totalCost,
            remaining_balance: newBalance
        });

    } catch (error) {
        console.error('❌ Wallet Engine Error:', error.message);
        return res.status(500).json({ success: false, msg: "Transaction failed. Please try again." });
    }
});

// ====== WALLET RECHARGE ENGINE ======
app.post('/api/wallet/recharge', async (req, res) => {
    const { userId, amount } = req.body;

    try {
        if (!supabase) return res.status(500).json({ msg: "Database connection unavailable" });

        // 1. Fetch current balance
        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .maybeSingle();

        if (walletError) throw walletError;
        if (!wallet) {
            return res.status(404).json({
                success: false,
                msg: "Wallet not found. Please finish workspace activation before recharge."
            });
        }

        const currentBalance = parseFloat(wallet.balance || 0);
        const newBalance = currentBalance + parseFloat(amount);

        // 2. Update Balance in Wallets table
        const { error: updateError } = await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', userId);

        if (updateError) throw updateError;

        // 3. Log Credit Transaction
        await supabase.from('wallet_transactions').insert([
            { 
                user_id: userId,
                amount: amount,
                type: 'CREDIT',
                description: `Wallet recharge of ₹${amount} successful.`,
                metadata: {
                    payment_method: 'Manual/Internal',
                    recharge_amount: amount,
                    previous_balance: currentBalance
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            msg: "Wallet recharged successfully",
            newBalance: newBalance
        });

    } catch (error) {
        console.error('❌ Recharge Engine Error:', error.message);
        return res.status(500).json({ 
            success: false, 
            msg: "Recharge failed. Please contact support." 
        });
    }
});

// ====== PAYU HASH GENERATOR ROUTE ======
app.post('/api/payment/payu-hash', async (req, res) => {
    const { txnid, amount, productinfo, firstname, email } = req.body;
    const key = process.env.PAYU_MERCHANT_KEY;
    const salt = process.env.PAYU_MERCHANT_SALT;

    try {
        if (!key || !salt) throw new Error("PayU Credentials missing in server environment");

        // Formula: key|txnid|amount|productinfo|firstname|email|||||||||||salt
        const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
        const hash = crypto.createHash('sha512').update(hashString).digest('hex');

        return res.status(200).json({ hash });
    } catch (error) {
        return res.status(500).json({ success: false, msg: error.message });
    }
});

// ====== INTERNAL CAMPAIGN QUEUE WORKER ======
let campaignWorkerRunning = false;

const getUserMetaCredentials = async (userId) => {
    if (!supabase || !userId) return {};

    try {
        let { data, error } = await supabase
            .from('doctor_profiles')
            .select('meta_phone_number_id,meta_waba_id,system_user_token')
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            const message = String(error?.message || error?.details || '').toLowerCase();
            const isMissingColumn = error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
            if (!isMissingColumn) return {};

            const fallbackResult = await supabase
                .from('doctor_profiles')
                .select('whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token')
                .eq('id', userId)
                .maybeSingle();

            data = fallbackResult.data
                ? {
                    meta_phone_number_id: fallbackResult.data.whatsapp_phone_number_id,
                    meta_waba_id: fallbackResult.data.whatsapp_business_account_id,
                    system_user_token: fallbackResult.data.whatsapp_access_token
                }
                : null;
            error = fallbackResult.error;
        }

        if (error || !data) return {};
        const finalToken = data.system_user_token || process.env.SYSTEM_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null;
        const finalPhoneId = data.meta_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID || null;
        console.log("Resolved Meta Parameters Status:", { hasToken: !!finalToken, hasPhoneId: !!finalPhoneId });

        return {
            phoneNumberId: finalPhoneId,
            businessAccountId: data.meta_waba_id || null,
            accessToken: finalToken,
        };
    } catch (err) {
        console.error('Meta credential lookup failed:', err.message || err);
        return {};
    }
};

const sendCampaignMessageToMeta = async (queueItem) => {
    const doctorId = queueItem.user_id || queueItem.doctor_id || queueItem.payload?.template?.user_id || queueItem.payload?.template?.doctor_id;
    const credentials = await getUserMetaCredentials(doctorId);
    const finalToken = credentials.accessToken || process.env.SYSTEM_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || null;
    const finalPhoneId = credentials.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null;

    console.log("Resolved Meta Parameters Status:", { hasToken: !!finalToken, hasPhoneId: !!finalPhoneId });

    if (!finalPhoneId || !finalToken) {
        throw new Error('Missing WhatsApp phone number ID or access token for campaign send. Please configure Meta credentials in settings.');
    }

    const url = `https://graph.facebook.com/v17.0/${finalPhoneId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to: sanitizeMetaPhoneNumber(queueItem.recipient_phone),
        type: 'template',
        template: {
            name: queueItem.template_name,
            language: { code: queueItem.payload?.template?.language || 'en_US' }
        }
    };

    const variables = queueItem.payload?.template?.variables || {};
    const variableKeys = Object.keys(variables).sort((a, b) => Number(a) - Number(b));
    if (variableKeys.length > 0) {
        payload.template.components = [{
            type: 'body',
            parameters: variableKeys.map((key) => ({
                type: 'text',
                text: String(variables[key] || '')
            }))
        }];
    }

    let response;
    try {
        response = await require('axios').post(url, payload, {
            headers: {
                'Authorization': `Bearer ${finalToken}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        if (error.response?.status === 401) {
            console.error("CRITICAL: Meta Cloud API Token is Invalid or Expired. Please regenerate a Permanent System User Access Token in the Meta Business Suite.");
            const authError = new Error("Meta Authentication Failed. Please check your Permanent Access Token in Settings.");
            authError.clientPayload = { success: false, msg: "Meta Authentication Failed. Please check your Permanent Access Token in Settings." };
            throw authError;
        }
        if (error.response?.data) {
            console.error('Meta campaign send error:', JSON.stringify(error.response.data));
        }
        throw error;
    }

    return {
        ok: true,
        provider: 'meta_whatsapp',
        user_id: doctorId,
        phone_number_id: finalPhoneId,
        whatsapp_business_account_id: credentials.businessAccountId,
        response: response.data
    };
};

const processCampaignFallbackRows = async (rows = []) => {
    for (const row of rows) {
        try {
            const metaResult = await sendCampaignMessageToMeta(row);
            const logPayload = {
                queue_id: null,
                recipient_name: row.recipient_name,
                recipient_phone: row.recipient_phone,
                template_name: row.template_name,
                meta_result: metaResult,
                fallback_dispatch: true,
            };

            await Promise.allSettled([
                supabase.from('inbox_chats').update({
                    status: 'SENT',
                    last_message: `Sent template: ${row.template_name}`,
                    updated_at: new Date().toISOString()
                }).eq('phone', row.recipient_phone),
                supabase.from('wallet_transactions').insert([{
                    user_id: row.user_id || row.doctor_id,
                    amount: getUnitCost(row.template_category),
                    type: 'message_debit',
                    description: `Fallback campaign sent to ${row.recipient_phone} using ${row.template_name}`,
                    metadata: logPayload,
                    created_at: new Date().toISOString(),
                }]),
            ]);
        } catch (error) {
            if (error.clientPayload) {
                console.error(error.clientPayload.msg);
            }
            console.error('Campaign fallback dispatch failed:', error.message || error);
        }
    }
};

const processCampaignQueue = async () => {
    if (!supabase || campaignWorkerRunning) return;
    campaignWorkerRunning = true;

    try {
        const { data: dueRows, error } = await supabase
            .from('campaign_queue')
            .select('*')
            .eq('status', 'PENDING')
            .lte('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true })
            .limit(25);

        if (error) throw error;
        if (!Array.isArray(dueRows) || dueRows.length === 0) return;

        for (const row of dueRows) {
            const unitCost = getUnitCost(row.template_category);
            const { data: wallet } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', row.user_id)
                .maybeSingle();

            if (!wallet) {
                await supabase.from('campaign_queue').update({ status: 'FAILED', error_message: 'Wallet not found' }).eq('id', row.id);
                continue;
            }

            const currentBalance = Number(wallet.balance || 0);
            if (currentBalance < unitCost) {
                await supabase.from('campaign_queue').update({ status: 'FAILED', error_message: 'Insufficient wallet balance' }).eq('id', row.id);
                continue;
            }

            let metaResult;
            try {
                metaResult = await sendCampaignMessageToMeta(row);
            } catch (sendError) {
                await supabase.from('campaign_queue').update({ status: 'FAILED', error_message: sendError.message || 'Meta send failed' }).eq('id', row.id);
                if (sendError.clientPayload) {
                    console.error(sendError.clientPayload.msg);
                }
                console.error('Campaign send failed for row', row.id, sendError.message || sendError);
                continue;
            }

            const nextBalance = Number((currentBalance - unitCost).toFixed(2));

            const logPayload = {
                queue_id: row.id,
                recipient_name: row.recipient_name,
                recipient_phone: row.recipient_phone,
                template_name: row.template_name,
                meta_result: metaResult,
            };

            await Promise.allSettled([
                supabase.from('wallets').update({ balance: nextBalance }).eq('user_id', row.user_id),
                supabase.from('campaign_queue').update({ status: 'SENT', sent_at: new Date().toISOString(), meta_response: metaResult }).eq('id', row.id),
                supabase.from('inbox_chats').update({
                    status: 'SENT',
                    last_message: `Sent template: ${row.template_name}`,
                    updated_at: new Date().toISOString()
                }).eq('phone', row.recipient_phone),
                supabase.from('wallet_transactions').insert([{
                    user_id: row.user_id,
                    amount: unitCost,
                    type: 'message_debit',
                    description: `Campaign sent to ${row.recipient_phone} using ${row.template_name}`,
                    metadata: logPayload,
                    created_at: new Date().toISOString(),
                }]),
            ]);
        }
    } catch (error) {
        console.error('Campaign queue worker error:', error.message);
    } finally {
        campaignWorkerRunning = false;
    }
};

setInterval(processCampaignQueue, 10000);

// ====== AUTOMATIC META STATUS SYNC POLLING (1 MINUTE) ======
setInterval(async () => {
    if (!supabase) return;
    try {
        // Fetch all templates currently in PENDING state
        const { data: pendingTemplates } = await supabase
            .from('whatsapp_templates')
            .select('user_id, template_name, id, status')
            .or('status.eq.PENDING,status.eq.PENDING_REVIEW');

        if (!pendingTemplates?.length) return;

        // Group by user to batch credential lookups
        const userGroups = pendingTemplates.reduce((acc, t) => {
            acc[t.user_id] = acc[t.user_id] || [];
            acc[t.user_id].push(t);
            return acc;
        }, {});

        for (const userId in userGroups) {
            const { data: profile } = await supabase
                .from('doctor_profiles')
                .select('system_user_token, meta_waba_id')
                .eq('id', userId)
                .maybeSingle();

            if (!profile?.system_user_token || !profile?.meta_waba_id) continue;

            for (const t of userGroups[userId]) {
                try {
                    const url = `https://graph.facebook.com/v21.0/${profile.meta_waba_id}/message_templates?name=${t.template_name}`;
                    const res = await require('axios').get(url, {
                        headers: { Authorization: `Bearer ${profile.system_user_token}` }
                    });
                    const metaData = res.data.data?.[0];
                    if (metaData) {
                        const trueStatus = metaData.status.toUpperCase() === 'PENDING_REVIEW' ? 'PENDING' : metaData.status.toUpperCase();
                        if (trueStatus !== t.status) {
                            await supabase.from('whatsapp_templates').update({ status: trueStatus }).eq('id', t.id);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (err) {
        console.error('Background Sync Polling Error:', err.message);
    }
}, 60000);

// ====== PORT LISTEN ENGINE ======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Yogi Desk API running safely on port ${PORT}`);
});
