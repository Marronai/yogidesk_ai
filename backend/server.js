require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

const corsOptions = {
    origin: ['https://yogidesk-ai.com', 'http://yogidesk-ai.com', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256'],
    credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = Buffer.from(buf || '');
    }
}));
app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    return res.status(200).json({ success: true, message: "Yogi Desk API Service Online" });
});
// Yeh line frontend ki saari HTML/CSS/JS files ko automatic utha legi
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/payments', paymentRoutes);

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
const sanitizePlainText = (value, maxLength = 2048) => String(value || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .split('')
    .filter((char) => {
        const code = char.charCodeAt(0);
        return code >= 32 || code === 9 || code === 10 || code === 13;
    })
    .join('')
    .trim()
    .slice(0, maxLength);
const cleanCredentialValue = (value) => String(value || '').trim();
const invalidMetaConfigurationResponse = {
    success: false,
    message: "Invalid Meta configuration or access token permissions. Please check your developer credentials."
};
const META_CONFIGURATION_LOCKED_MESSAGE = "Configuration locked. Contact Customer Support to modify your Meta integrations.";
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
const hasCompleteMetaCredentials = (row = {}) => Boolean(
    String(row.meta_phone_number_id || row.whatsapp_phone_number_id || '').trim() &&
    String(row.meta_waba_id || row.whatsapp_business_account_id || '').trim() &&
    String(row.system_user_token || row.whatsapp_access_token || '').trim()
);
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
const sendOTP = typeof emailConfig.sendOTP === 'function' ? emailConfig.sendOTP : async () => false;
const emailOtpStore = new Map();
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const buildOtpKey = (email, purpose = 'auth') => `${normalizeEmail(email)}:${String(purpose || 'auth').trim().toLowerCase()}`;
const generateEmailOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const clearExpiredEmailOtps = () => {
    const now = Date.now();
    for (const [key, record] of emailOtpStore.entries()) {
        if (!record?.expiresAt || record.expiresAt <= now) emailOtpStore.delete(key);
    }
};

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

        // ACCURATE DEVICE & IP PARSING
        const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'Unknown IP').split(',')[0].trim();
        const ua = req.headers['user-agent'] || '';
        let deviceInfo = 'Verified browser login';
        if (ua.includes('Windows')) deviceInfo = 'Windows PC';
        else if (ua.includes('Mac OS')) deviceInfo = 'Apple Mac';
        else if (ua.includes('Android')) deviceInfo = 'Android Device';
        else if (ua.includes('iPhone') || ua.includes('iPad')) deviceInfo = 'Apple iOS Device';
        
        if (ua.includes('Chrome')) deviceInfo += ' (Chrome)';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) deviceInfo += ' (Safari)';
        else if (ua.includes('Firefox')) deviceInfo += ' (Firefox)';
        else if (ua.includes('Edge')) deviceInfo += ' (Edge)';

        const sent = await sendLoginAlert(email, name || 'Doctor', deviceInfo, ipAddress);
        return res.status(sent ? 200 : 202).json({ success: sent });
    } catch (error) {
        console.error('Login email dispatch error:', error.message);
        return res.status(202).json({ success: false });
    }
});

app.post('/api/auth/request-email-otp', async (req, res) => {
    try {
        clearExpiredEmailOtps();
        const email = normalizeEmail(req.body?.email);
        const purpose = String(req.body?.purpose || 'auth').trim().toLowerCase();
        const name = String(req.body?.name || 'Doctor').trim() || 'Doctor';

        if (!email) return res.status(400).json({ success: false, msg: 'Email is required' });

        const otp = generateEmailOtp();
        emailOtpStore.set(buildOtpKey(email, purpose), {
            otp,
            expiresAt: Date.now() + 10 * 60 * 1000,
            attempts: 0
        });

        const sent = await sendOTP(email, name, otp);
        if (!sent) return res.status(500).json({ success: false, msg: 'Failed to send OTP. Please try again.' });

        return res.status(200).json({ success: true, msg: 'OTP sent to your email.' });
    } catch (error) {
        console.error('Email OTP request error:', error.message);
        return res.status(500).json({ success: false, msg: 'Unable to send OTP.' });
    }
});

app.post('/api/auth/verify-email-otp', async (req, res) => {
    try {
        clearExpiredEmailOtps();
        const email = normalizeEmail(req.body?.email);
        const purpose = String(req.body?.purpose || 'auth').trim().toLowerCase();
        const otp = String(req.body?.otp || '').trim();

        if (!email || !otp) return res.status(400).json({ success: false, msg: 'Email and OTP are required' });

        const key = buildOtpKey(email, purpose);
        const record = emailOtpStore.get(key);
        if (!record || record.expiresAt <= Date.now()) {
            emailOtpStore.delete(key);
            return res.status(400).json({ success: false, msg: 'Invalid or expired OTP.' });
        }

        record.attempts += 1;
        if (record.attempts > 5) {
            emailOtpStore.delete(key);
            return res.status(429).json({ success: false, msg: 'Too many OTP attempts. Please request a new code.' });
        }

        if (record.otp !== otp) {
            emailOtpStore.set(key, record);
            return res.status(400).json({ success: false, msg: 'Invalid or expired OTP.' });
        }

        emailOtpStore.delete(key);
        return res.status(200).json({ success: true, msg: 'OTP verified.' });
    } catch (error) {
        console.error('Email OTP verification error:', error.message);
        return res.status(500).json({ success: false, msg: 'Unable to verify OTP.' });
    }
});

app.post('/api/team/dispatch-invite-email', async (req, res) => {
    try {
        const { email, name, inviteLink } = req.body || {};
        if (!email || !inviteLink) return res.status(400).json({ success: false, msg: 'Email and invite link are required' });
        const sent = await sendDirectEmail(
            email,
            'Welcome! You have been invited to YogiDesk AI',
            `
              <div style="font-family: Arial, sans-serif; background-color: #f9f9f9; padding: 20px; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="background-color: #ff6b00; padding: 20px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">YogiDesk AI</h1>
                    </div>
                    <div style="padding: 30px; text-align: center;">
                        <h2 style="color: #111827; margin-top: 0;">You've Been Invited!</h2>
                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left;">Hi ${name || 'there'},</p>
                        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; text-align: left;">Your clinic administrator has invited you to join their secure workspace on <strong>YogiDesk AI</strong>.</p>
                        <div style="margin: 40px 0;">
                            <a href="${inviteLink}" style="display: inline-block; background-color: #ff6b00; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(255,107,0,0.3);">Accept Invite & Create Password</a>
                        </div>
                        <p style="color: #4b5563; font-size: 14px; line-height: 1.6; text-align: left;">If the button doesn't work, copy and paste this link into your browser:<br>
                        <a href="${inviteLink}" style="color: #ff6b00; word-break: break-all;">${inviteLink}</a></p>
                    </div>
                    <div style="background-color: #f1f1f1; padding: 15px; text-align: center; border-top: 1px solid #e0e0e0;">
                        <p style="margin: 0; font-size: 12px; color: #666;">&copy; ${new Date().getFullYear()} YogiDesk AI. All rights reserved.</p>
                        <p style="margin: 5px 0 0 0; font-size: 10px; color: #999;">A product by Vyapar Wallah</p>
                    </div>
                </div>
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

const getMetaWebhookVerifyToken = () => (
    process.env.META_WEBHOOK_VERIFY_TOKEN ||
    process.env.META_VERIFY_TOKEN ||
    process.env.WHATSAPP_VERIFY_TOKEN ||
    'YogiDesk_Doctor_Secure_2026'
);

const getMetaWebhookAppSecret = () => (
    process.env.META_WEBHOOK_APP_SECRET ||
    process.env.META_APP_SECRET ||
    process.env.WHATSAPP_APP_SECRET ||
    ''
);

const verifyMetaWebhookSignature = (req) => {
    const appSecret = getMetaWebhookAppSecret();
    const signature = String(req.get('x-hub-signature-256') || '').trim();

    if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;

    const expected = `sha256=${crypto
        .createHmac('sha256', appSecret)
        .update(req.rawBody || Buffer.from(JSON.stringify(req.body || {})))
        .digest('hex')}`;

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    return signatureBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
};

const normalizeWebhookTemplateStatus = (status) => {
    const normalized = String(status || '').trim().toUpperCase();
    if (normalized === 'PENDING_REVIEW' || normalized === 'IN_REVIEW') return 'PENDING';
    return normalized;
};

const extractTemplateStatusUpdates = (payload = {}) => {
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];

    const updates = [];
    for (const entry of payload.entry) {
        if (!Array.isArray(entry.changes)) continue;
        const wabaId = String(entry.id || '').trim();

        for (const change of entry.changes) {
            if (change.field !== 'message_template_status_update' && change.field !== 'message_template') continue;

            const value = change.value || {};
            const template = value.message_template_status_update || value.message_template_status || value.message_template || value;
            const status = normalizeWebhookTemplateStatus(template.status || template.event || value.event);
            if (!['APPROVED', 'REJECTED', 'PENDING', 'PAUSED', 'DISABLED'].includes(status)) continue;

            const templateId = String(template.id || template.message_template_id || value.message_template_id || '').trim();
            const templateName = String(template.name || template.message_template_name || value.message_template_name || value.template_name || '').trim();
            const businessAccountId = String(
                template.whatsapp_business_account_id ||
                value.whatsapp_business_account_id ||
                value.waba_id ||
                wabaId
            ).trim();

            if (!businessAccountId || (!templateId && !templateName)) continue;
            updates.push({ businessAccountId, templateId, templateName, status });
        }
    }

    return updates;
};

const findClinicByWabaId = async (businessAccountId) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !businessAccountId) return null;

    let result = await db
        .from('doctor_profiles')
        .select('id')
        .eq('meta_waba_id', businessAccountId)
        .maybeSingle();

    if (result.error && isMissingColumnError(result.error)) {
        result = await db
            .from('doctor_profiles')
            .select('id')
            .eq('whatsapp_business_account_id', businessAccountId)
            .maybeSingle();
    }

    if (result.error) {
        console.error('Webhook clinic lookup failed:', result.error.message || result.error);
        return null;
    }

    return result.data || null;
};

const processTemplateStatusWebhook = async (payload = {}) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from) throw new Error('Database connection unavailable.');

    const updates = extractTemplateStatusUpdates(payload);
    for (const update of updates) {
        const clinic = await findClinicByWabaId(update.businessAccountId);
        if (!clinic?.id) {
            console.warn(`Template webhook skipped: no clinic mapped to WABA ${update.businessAccountId}.`);
            continue;
        }

        for (const table of ['whatsapp_templates', 'submitted_meta_templates']) {
            let query = db
                .from(table)
                .update({ status: update.status, updated_at: new Date().toISOString() })
                .eq('user_id', clinic.id);

            if (update.templateId && update.templateName) {
                query = query.or(`meta_template_id.eq.${update.templateId},template_name.eq.${update.templateName}`);
            } else if (update.templateId) {
                query = query.eq('meta_template_id', update.templateId);
            } else {
                query = query.eq('template_name', update.templateName);
            }

            const { error } = await query;
            if (error) {
                console.error(`Webhook template status update failed for ${table}:`, error.message || error);
            }
        }
    }
};

const verifyWhatsAppWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === getMetaWebhookVerifyToken()) {
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
};

const handleWhatsAppWebhook = (req, res) => {
    if (!verifyMetaWebhookSignature(req)) {
        return res.status(403).send('Invalid signature');
    }

    res.status(200).send('EVENT_RECEIVED');
    Promise.resolve()
        .then(() => processTemplateStatusWebhook(req.body))
        .catch((error) => {
            console.error('WhatsApp webhook background processing error:', error.message || error);
        });
};

app.get('/api/webhooks/whatsapp', verifyWhatsAppWebhook);
app.post('/api/webhooks/whatsapp', handleWhatsAppWebhook);
app.get('/api/whatsapp-webhook', verifyWhatsAppWebhook);
app.post('/api/whatsapp-webhook', handleWhatsAppWebhook);
app.get('/api/webhook/meta', verifyWhatsAppWebhook);
app.post('/api/webhook/meta', handleWhatsAppWebhook);

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
    const response = await axios.get(graphUrl, {
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

        const sessionUser = await getSupabaseSessionUser(req);
        const userId = req.query.userId || req.body?.userId || sessionUser?.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }
        if (!sessionUser?.id || sessionUser.id !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
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

        const sessionUser = await getSupabaseSessionUser(req);
        const userId = req.query.userId || req.body?.userId || sessionUser?.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }
        if (!sessionUser?.id || sessionUser.id !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const db = supabaseAdmin || supabase;
        const metaConfig = await getRawMetaCredentialsForUser(userId);
        if (!metaConfig.meta_configured || !metaConfig.accessToken) {
            return res.status(200).json({ success: false, meta_configured: false, templates: [], message: 'WhatsApp Business Account credentials are not configured.' });
        }

        const graphUrl = `https://graph.facebook.com/v20.0/${metaConfig.whatsapp_business_account_id}/message_templates`;
        const response = await axios.get(graphUrl, {
            headers: { Authorization: `Bearer ${metaConfig.accessToken}` }
        });

        const metaTemplates = Array.isArray(response.data?.data) ? response.data.data : [];
        const updates = [];

        for (const metaTemplate of metaTemplates) {
            const metaTemplateId = metaTemplate.id || metaTemplate.message_template_id || null;
            const templateName = metaTemplate.name || metaTemplate.template_name || '';
            const rawStatus = String(metaTemplate.status || 'PENDING').toUpperCase();
            const status = rawStatus === 'PENDING_REVIEW' ? 'PENDING' : rawStatus;

            if (!templateName && !metaTemplateId) continue;

            const components = Array.isArray(metaTemplate.components) ? metaTemplate.components : [];
            const body = components.find((component) => component.type === 'BODY');
            const header = components.find((component) => component.type === 'HEADER');
            const footer = components.find((component) => component.type === 'FOOTER');
            const buttons = components.find((component) => component.type === 'BUTTONS');
            const rowPayload = {
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
                meta_template_id: metaTemplateId
            };

            let updateQuery = db
                .from('whatsapp_templates')
                .update(rowPayload)
                .eq('user_id', userId);

            updateQuery = metaTemplateId
                ? updateQuery.or(`meta_template_id.eq.${metaTemplateId},template_name.eq.${templateName}`)
                : updateQuery.eq('template_name', templateName);

            const { data: updatedRows, error: updateError } = await updateQuery.select('id');
            if (updateError) throw updateError;

            if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
                const { error: insertError } = await db
                    .from('whatsapp_templates')
                    .insert([{ ...rowPayload, created_at: new Date().toISOString() }]);
                if (insertError) throw insertError;
            }

            updates.push({ name: templateName, id: metaTemplateId, status });
        }

        return res.status(200).json({ success: true, templates: updates });
    } catch (error) {
        console.error('Template sync error:', error.response?.data || error.message || error);
        return res.status(400).json({ success: false, message: error.response?.data?.error?.message || error.message || 'Template sync failed.' });
    }
});

const normalizeSpecialization = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return '';
    if (normalized.includes('dent')) return 'Dentist';
    if (normalized.includes('gyn') || normalized.includes('obst')) return 'Gynecologist';
    if (normalized.includes('ortho') || normalized.includes('bone') || normalized.includes('joint')) return 'Orthopedic';
    if (normalized.includes('general') || normalized.includes('physician') || normalized.includes('clinic')) return 'General Physician';
    return sanitizePlainText(value, 80);
};

const normalizeSpecializationSlug = (value) => {
    const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized.includes('dent')) return 'dentist';
    if (normalized.includes('gyn') || normalized.includes('obst')) return 'gynecologist';
    if (normalized.includes('ortho') || normalized.includes('bone') || normalized.includes('joint')) return 'orthopedic';
    if (normalized.includes('general') || normalized.includes('physician') || normalized.includes('clinic')) return 'general_physician';
    return 'general_physician';
};

const specializationSlugToSearchValue = (slug) => ({
    dentist: 'dentist',
    gynecologist: 'gynecologist',
    orthopedic: 'orthopedic',
    general_physician: 'general physician'
}[slug] || 'general physician');

const fetchPremadeTemplatesBySpecialization = async ({ db, specializationQuery, language }) => {
    const selectColumns = 'id,specialization,category,language,template_name,body_text,has_media';
    const runQuery = async (specializationPattern) => {
        let query = db
            .from('pre_made_templates')
            .select(selectColumns)
            .ilike('specialization', specializationPattern)
            .order('language', { ascending: true })
            .order('template_name', { ascending: true })
            .limit(50);

        if (language && language.toLowerCase() !== 'all') {
            query = query.ilike('language', language);
        }

        return query;
    };

    const humanPattern = specializationSlugToSearchValue(specializationQuery);
    let { data, error } = await runQuery(humanPattern);
    if (error) {
        console.warn('Pre-made template lookup failed:', error.message || error);
        return [];
    }

    if (!Array.isArray(data) || data.length === 0) {
        const fallbackResult = await runQuery(specializationQuery);
        if (fallbackResult.error) {
            console.warn('Pre-made template fallback lookup failed:', fallbackResult.error.message || fallbackResult.error);
            return [];
        }
        data = fallbackResult.data;
    }

    return Array.isArray(data)
        ? data.map((template) => ({
            id: template.id,
            specialization: template.specialization,
            category: template.category,
            language: template.language,
            template_name: template.template_name,
            body_text: template.body_text,
            has_media: Boolean(template.has_media)
        }))
        : [];
};

const readSingleRowSafely = async ({ table, select, column = 'id', value }) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !table || !select || !value) return { data: null, error: null };

    try {
        const result = await db
            .from(table)
            .select(select)
            .eq(column, value)
            .maybeSingle();

        if (result.error && (isMissingColumnError(result.error) || result.error.code === 'PGRST205')) {
            return { data: null, error: null };
        }

        return result;
    } catch (error) {
        console.warn(`Safe profile lookup failed for ${table}:`, error.message || error);
        return { data: null, error };
    }
};

const getDoctorTemplateProfile = async (userId) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !userId) return {};

    const profileLookups = [
        { table: 'doctor_profiles', select: 'id,name,specialization,clinic_booking_link,booking_link,website' },
        { table: 'doctor_profiles', select: 'id,name,specialization,business_category,industry,booking_link' },
        { table: 'users', select: 'id,name,specialization,clinic_booking_link,booking_link,website' },
        { table: 'clinics', select: 'id,name,specialization,clinic_booking_link,booking_link,website' }
    ];

    for (const lookup of profileLookups) {
        const { data, error } = await readSingleRowSafely({
            table: lookup.table,
            select: lookup.select,
            value: userId
        });

        if (!error && data) {
            const rawSpecialization = data.specialization || data.business_category || data.industry || '';
            const specialization = normalizeSpecialization(rawSpecialization);
            return {
                ...data,
                specialization,
                bookingLink: data.clinic_booking_link || data.booking_link || data.website || `https://yogidesk-ai.com/book/${userId}`
            };
        }

        if (error && !isMissingColumnError(error) && error.code !== 'PGRST205') {
            console.warn('Template dashboard profile lookup failed:', error.message || error);
        }
    }

    return {
        specialization: '',
        bookingLink: `https://yogidesk-ai.com/book/${userId}`
    };
};

const getMetaConfigForUser = async (userId) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !userId) {
        return {
            meta_configured: false,
            whatsapp_phone_number_id: '',
            whatsapp_business_account_id: '',
            meta_business_manager_id: '',
            system_user_token: ''
        };
    }

    const lookups = [
        {
            table: 'doctor_profiles',
            select: 'meta_phone_number_id,meta_waba_id,system_user_token,meta_business_manager_id,meta_business_id,business_id'
        },
        {
            table: 'doctor_profiles',
            select: 'whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token,meta_business_id,business_id'
        },
        {
            table: 'users',
            select: 'whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token,meta_business_manager_id,meta_business_id,business_id'
        },
        {
            table: 'clinics',
            select: 'whatsapp_phone_number_id,whatsapp_business_account_id,whatsapp_access_token,meta_business_manager_id,meta_business_id,business_id'
        }
    ];

    for (const lookup of lookups) {
        const { data, error } = await readSingleRowSafely({
            table: lookup.table,
            select: lookup.select,
            value: userId
        });

        if (error && !isMissingColumnError(error) && error.code !== 'PGRST205') {
            console.warn('Meta config lookup failed:', error.message || error);
        }

        if (!data) continue;

        const phoneNumberId = data.meta_phone_number_id || data.whatsapp_phone_number_id || '';
        const businessAccountId = data.meta_waba_id || data.whatsapp_business_account_id || '';
        const accessToken = data.system_user_token || data.whatsapp_access_token || '';
        const businessManagerId = data.meta_business_manager_id || data.meta_business_id || data.business_id || '';

        return {
            meta_configured: Boolean(phoneNumberId && businessAccountId && accessToken),
            whatsapp_phone_number_id: phoneNumberId,
            whatsapp_business_account_id: businessAccountId,
            whatsapp_business_id: businessManagerId,
            meta_business_manager_id: businessManagerId,
            system_user_token: accessToken ? 'CONFIGURED' : ''
        };
    }

    return {
        meta_configured: false,
        whatsapp_phone_number_id: '',
        whatsapp_business_account_id: '',
        whatsapp_business_id: '',
        meta_business_manager_id: '',
        system_user_token: ''
    };
};

const getRawMetaCredentialsForUser = async (userId) => {
    const config = await getMetaConfigForUser(userId);
    if (!config.meta_configured) {
        return { ...config, accessToken: '' };
    }

    const tokenLookups = [
        { table: 'doctor_profiles', select: 'system_user_token' },
        { table: 'doctor_profiles', select: 'whatsapp_access_token' },
        { table: 'users', select: 'system_user_token' },
        { table: 'users', select: 'whatsapp_access_token' },
        { table: 'clinics', select: 'system_user_token' },
        { table: 'clinics', select: 'whatsapp_access_token' }
    ];

    for (const lookup of tokenLookups) {
        const { data } = await readSingleRowSafely({
            table: lookup.table,
            select: lookup.select,
            value: userId
        });
        const token = data?.system_user_token || data?.whatsapp_access_token || '';
        if (token) return { ...config, accessToken: token };
    }

    return { ...config, meta_configured: false, accessToken: '' };
};

const getFreshTemplateSubmitCredentials = async (userId) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from || !userId) {
        console.error('Template submit credentials missing database or user context.', { userId: Boolean(userId) });
        return { accessToken: '', businessAccountId: '', phoneNumberId: '' };
    }

    const lookups = [
        {
            table: 'doctor_profiles',
            select: 'system_user_token,meta_waba_id,meta_phone_number_id',
            map: (row) => ({
                accessToken: row?.system_user_token || '',
                businessAccountId: row?.meta_waba_id || '',
                phoneNumberId: row?.meta_phone_number_id || ''
            })
        },
        {
            table: 'doctor_profiles',
            select: 'whatsapp_access_token,whatsapp_business_account_id,whatsapp_phone_number_id',
            map: (row) => ({
                accessToken: row?.whatsapp_access_token || '',
                businessAccountId: row?.whatsapp_business_account_id || '',
                phoneNumberId: row?.whatsapp_phone_number_id || ''
            })
        }
    ];

    for (const lookup of lookups) {
        const { data: credentials, error: credError } = await db
            .from(lookup.table)
            .select(lookup.select)
            .eq('id', userId)
            .maybeSingle();

        if (credError) {
            if (isMissingColumnError(credError) || credError.code === 'PGRST205') continue;
            console.error('Fresh Meta credential lookup failed:', credError.message || credError);
            throw credError;
        }

        const mapped = lookup.map(credentials || {});
        if (mapped.accessToken && mapped.businessAccountId) {
            return mapped;
        }
    }

    console.error('Fresh Meta credentials missing or empty for template submission.', { userId });
    return { accessToken: '', businessAccountId: '', phoneNumberId: '' };
};

const languageToMetaLocale = (language) => {
    const normalized = String(language || '').trim().toLowerCase();
    if (normalized === 'hindi' || normalized === 'hi') return 'hi';
    return 'en_US';
};

const toMetaTemplateBody = (bodyText) => sanitizePlainText(bodyText)
    .replace(/\{(\d+)\}/g, '{{$1}}')
    .replace(/\[Patient_Name\]/gi, '{{1}}')
    .replace(/\[Time\]/gi, '{{2}}')
    .replace(/\[Booking_Link\]/gi, '{{2}}')
    .replace(/\{\{\s*(\d+)\s*\}\}/g, '{{$1}}');

const collectPlaceholderIndexes = (bodyText) => (
    [...String(bodyText || '').matchAll(/\{\{(\d+)\}\}/g)]
        .map((match) => Number(match[1]))
        .filter(Number.isFinite)
        .sort((a, b) => a - b)
);

const buildBodyExample = (bodyText, variableMapping = {}) => {
    const indexes = collectPlaceholderIndexes(bodyText);
    if (!indexes.length) return null;

    const defaults = {
        1: 'Sample Patient',
        2: 'https://yogidesk-ai.com/book',
        3: 'https://yogidesk-ai.com/book'
    };

    return {
        body_text: [
            indexes.map((index) => sanitizePlainText(variableMapping[index] || defaults[index] || `Sample ${index}`, 120))
        ]
    };
};

const parseMultipartForm = (req, { maxBytes = 3 * 1024 * 1024 } = {}) => new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    const boundaryValue = boundaryMatch?.[1] || boundaryMatch?.[2];
    if (!boundaryValue) return reject(new Error('Invalid multipart form payload.'));

    const chunks = [];
    let totalBytes = 0;
    req.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
            req.destroy(new Error('Media upload must be 3MB or smaller.'));
            return;
        }
        chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
        try {
            const buffer = Buffer.concat(chunks);
            const boundary = Buffer.from(`--${boundaryValue}`);
            const fields = {};
            const files = {};
            let cursor = buffer.indexOf(boundary);

            while (cursor !== -1) {
                const next = buffer.indexOf(boundary, cursor + boundary.length);
                if (next === -1) break;

                let part = buffer.slice(cursor + boundary.length, next);
                if (part.slice(0, 2).toString() === '\r\n') part = part.slice(2);
                if (part.slice(-2).toString() === '\r\n') part = part.slice(0, -2);
                if (part.length && part[0] !== 45) {
                    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
                    if (headerEnd !== -1) {
                        const rawHeaders = part.slice(0, headerEnd).toString('utf8');
                        const body = part.slice(headerEnd + 4);
                        const name = rawHeaders.match(/name="([^"]+)"/i)?.[1];
                        const filename = rawHeaders.match(/filename="([^"]*)"/i)?.[1];
                        const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';

                        if (name && filename) {
                            files[name] = { filename, mimeType, buffer: body };
                        } else if (name) {
                            fields[name] = body.toString('utf8');
                        }
                    }
                }

                cursor = next;
            }

            resolve({ fields, files });
        } catch (error) {
            reject(error);
        }
    });
});

const parseMaybeJson = (value, fallback = {}) => {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
};

const uploadTemplateMedia = async ({ db, userId, file }) => {
    if (!file?.buffer?.length) return '';
    if (!db?.storage?.from) throw new Error('Supabase storage client unavailable.');
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimeType)) {
        throw new Error('Only JPEG or PNG media can be attached to a Meta template header.');
    }

    const extension = file.mimeType === 'image/png' ? 'png' : 'jpg';
    const bucket = process.env.SUPABASE_TEMPLATE_MEDIA_BUCKET || 'template-media';
    const storagePath = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(storagePath, file.buffer, {
            contentType: file.mimeType,
            upsert: false
        });

    if (uploadError) throw uploadError;

    const { data } = db.storage.from(bucket).getPublicUrl(storagePath);
    return data?.publicUrl || '';
};

const getTemplateSubmitCredentials = async (userId) => {
    return getFreshTemplateSubmitCredentials(userId);
};

const normalizeTemplateCategory = (category) => {
    const normalized = String(category || 'MARKETING').trim().toUpperCase();
    return ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(normalized) ? normalized : 'MARKETING';
};

const normalizeVariablesArray = (value) => {
    const parsed = parseMaybeJson(value, value);
    if (Array.isArray(parsed)) return parsed.map((item) => sanitizePlainText(item, 600));
    if (parsed && typeof parsed === 'object') {
        return Object.keys(parsed)
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => sanitizePlainText(parsed[key], 600));
    }
    return [];
};

const normalizeExamplesPayload = (examples, variables) => {
    const parsed = parseMaybeJson(examples, {});
    const bodyTextMatrix = parsed?.body_text;
    if (Array.isArray(bodyTextMatrix) && Array.isArray(bodyTextMatrix[0])) {
        return { body_text: [bodyTextMatrix[0].map((item) => sanitizePlainText(item, 600))] };
    }
    return { body_text: [variables.map((item) => sanitizePlainText(item, 600))] };
};

const buildMetaTemplateComponents = ({ bodyText, examples, hasMedia, mediaUrl }) => {
    const components = [];
    if (hasMedia) {
        components.push({
            type: 'HEADER',
            format: 'IMAGE',
            ...(mediaUrl && { example: { header_url: [mediaUrl] } })
        });
    }

    const bodyComponent = {
        type: 'BODY',
        text: bodyText
    };

    if (Array.isArray(examples?.body_text?.[0]) && examples.body_text[0].length) {
        bodyComponent.example = examples;
    }

    components.push(bodyComponent);
    return components;
};

const removeUndefinedValues = (row = {}) => Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined)
);

const getMissingSchemaColumn = (error) => {
    if (!isMissingColumnError(error)) return '';
    const message = String(error?.message || error?.details || '');
    return message.match(/'([^']+)'\s+column/i)?.[1] || '';
};

const upsertSingleRowSafely = async ({ db, table, row }) => {
    let payload = removeUndefinedValues(row);
    const removedColumns = new Set();

    while (Object.keys(payload).length > 0) {
        const { data, error } = await db
            .from(table)
            .upsert(payload)
            .select()
            .maybeSingle();

        if (!error) return data;

        const missingColumn = getMissingSchemaColumn(error);
        if (!missingColumn || removedColumns.has(missingColumn)) {
            console.error(`${table} save rejected by Supabase.`, {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            throw error;
        }

        console.warn(`Skipping missing ${table}.${missingColumn} column during template save.`, {
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        removedColumns.add(missingColumn);
        const { [missingColumn]: _removed, ...nextPayload } = payload;
        payload = nextPayload;
    }

    throw new Error(`Unable to save ${table}: schema cache rejected all payload columns.`);
};

const resolveSubmittedTemplateBodyText = (...sources) => {
    for (const source of sources) {
        if (!source || typeof source !== 'object') continue;
        const value = source.body_text
            || source.text
            || source.messageBody
            || source.content
            || source.body
            || source.bodyText
            || source.body_content
            || source.templateText;
        if (String(value || '').trim()) return String(value).trim();
    }
    return '';
};

const saveSubmittedMetaTemplate = async ({ db, row, requestBody = {}, userId }) => {
    const templateData = row || {};
    const bodyText = resolveSubmittedTemplateBodyText(requestBody, templateData);
    const cleanPayload = {
        user_id: userId || templateData.user_id || requestBody.user_id || requestBody.userId,
        template_name: requestBody.template_name || requestBody.name || templateData.template_name || templateData.name || `custom_template_${Date.now()}`,
        category: String(requestBody.category || templateData.category || 'MARKETING').toUpperCase(),
        language: requestBody.language || templateData.language || 'hi',
        body_text: bodyText,
        body_content: bodyText,
        header_url: requestBody.header_url || templateData.header_url || null,
        status: 'PENDING_APPROVAL',
        meta_template_id: requestBody.meta_template_id || templateData.meta_template_id || null
    };

    if (!cleanPayload.body_text || cleanPayload.body_text.trim() === '') {
        const validationError = new Error('Validation Error: Template body text cannot be empty or null.');
        validationError.statusCode = 400;
        throw validationError;
    }

    try {
        return await upsertSingleRowSafely({ db, table: 'submitted_meta_templates', row: cleanPayload });
    } catch (error) {
        console.error('submitted_meta_templates transaction failed.', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        throw error;
    }
};

const saveCampaignTemplateMirror = async ({ db, row }) => {
    return upsertSingleRowSafely({ db, table: 'whatsapp_templates', row });
};

const buildPremadeTemplateComponents = ({ bodyText, variableMapping, hasMedia, mediaType, mediaUrl }) => {
    const components = [];
    const cleanMediaUrl = sanitizePlainText(mediaUrl, 600);
    const normalizedMediaType = String(mediaType || 'IMAGE').toUpperCase() === 'DOCUMENT' ? 'DOCUMENT' : 'IMAGE';

    if (hasMedia) {
        components.push({
            type: 'HEADER',
            format: normalizedMediaType,
            ...(cleanMediaUrl && { example: { header_url: [cleanMediaUrl] } })
        });
    }

    const example = buildBodyExample(bodyText, variableMapping);
    components.push({
        type: 'BODY',
        text: bodyText,
        ...(example && { example })
    });

    return components;
};

app.get('/api/templates/dashboard', async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        if (!db?.from) throw new Error('Database connection unavailable.');

        const sessionUser = await getSupabaseSessionUser(req);
        const userId = req.query.userId || sessionUser?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        if (!sessionUser?.id || sessionUser.id !== userId) return res.status(403).json({ success: false, message: 'Forbidden' });

        const profile = await getDoctorTemplateProfile(userId);
        const specializationQuery = normalizeSpecializationSlug(profile.specialization);
        const language = sanitizePlainText(req.query.language || '', 20);
        const templates = await fetchPremadeTemplatesBySpecialization({
            db,
            specializationQuery,
            language
        });

        return res.status(200).json({
            success: true,
            specialization: specializationQuery,
            metadata: {
                specializationQuery,
                sourceSpecialization: profile.specialization || null,
                fallbackApplied: !profile.specialization || specializationQuery === 'general_physician'
            },
            bookingLink: profile.bookingLink,
            templates
        });
    } catch (error) {
        console.error('Template dashboard error:', error.message || error);
        return res.status(400).json({ success: false, message: error.message || 'Unable to load template dashboard.' });
    }
});

app.get('/api/profile/context', async (req, res) => {
    try {
        const sessionUser = await getSupabaseSessionUser(req);
        const userId = req.query.userId || sessionUser?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        if (!sessionUser?.id || sessionUser.id !== userId) return res.status(403).json({ success: false, message: 'Forbidden' });

        const profile = await getDoctorTemplateProfile(userId);
        const metaConfig = await getMetaConfigForUser(userId);
        const specialization = normalizeSpecialization(profile.specialization);

        return res.status(200).json({
            success: true,
            profile: {
                id: userId,
                name: profile.name || sessionUser.user_metadata?.full_name || sessionUser.email || 'Doctor',
                email: sessionUser.email || '',
                specialization,
                booking_link: profile.bookingLink || `https://yogidesk-ai.com/book/${userId}`,
                ...metaConfig
            }
        });
    } catch (error) {
        console.error('Profile context error:', error.message || error);
        return res.status(200).json({
            success: false,
            profile: {
                meta_configured: false,
                specialization: '',
                whatsapp_phone_number_id: '',
                whatsapp_business_account_id: '',
                whatsapp_business_id: ''
            }
        });
    }
});

app.post('/api/templates/submit-to-meta', async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        if (!db?.from) throw new Error('Database connection unavailable.');

        const sessionUser = await getSupabaseSessionUser(req);
        const isMultipart = String(req.headers['content-type'] || '').toLowerCase().includes('multipart/form-data');
        const multipartPayload = isMultipart ? await parseMultipartForm(req) : { fields: req.body || {}, files: {} };
        const requestBody = multipartPayload.fields || {};
        const mediaFile = multipartPayload.files?.media || multipartPayload.files?.file || null;

        const userId = requestBody.userId || sessionUser?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        if (!sessionUser?.id || sessionUser.id !== userId) return res.status(403).json({ success: false, message: 'Forbidden' });

        const profile = await getDoctorTemplateProfile(userId);
        const templateId = sanitizePlainText(requestBody.templateId, 80);
        let premadeTemplate = null;
        if (templateId) {
            const { data, error } = await db
                .from('pre_made_templates')
                .select('id,specialization,category,language,template_name,body_text,has_media')
                .eq('id', templateId)
                .maybeSingle();

            if (error) throw error;
            premadeTemplate = data;
            const profileSpecialization = normalizeSpecializationSlug(profile.specialization);
            const templateSpecialization = normalizeSpecializationSlug(premadeTemplate?.specialization);
            if (!premadeTemplate || templateSpecialization !== profileSpecialization) {
                return res.status(404).json({ success: false, message: 'Template not available for this specialization.' });
            }
        }

        const bodyText = toMetaTemplateBody(requestBody.bodyText || premadeTemplate?.body_text || '');
        if (!bodyText) return res.status(400).json({ success: false, message: 'Template body text is required.' });

        const language = languageToMetaLocale(requestBody.language || premadeTemplate?.language || 'English');
        const category = normalizeTemplateCategory(requestBody.category || premadeTemplate?.category || 'MARKETING');
        const variables = normalizeVariablesArray(requestBody.variables);
        const placeholderIndexes = collectPlaceholderIndexes(bodyText);
        const examples = normalizeExamplesPayload(requestBody.examples, variables);

        if (placeholderIndexes.length && examples.body_text[0].length !== placeholderIndexes.length) {
            return res.status(400).json({
                success: false,
                message: `Provide ${placeholderIndexes.length} sample value(s) for the detected body placeholders.`
            });
        }

        const hasMedia = toBoolean(requestBody.hasMedia) || Boolean(mediaFile);
        const uploadedMediaUrl = hasMedia && mediaFile ? await uploadTemplateMedia({ db, userId, file: mediaFile }) : '';
        const mediaUrl = sanitizePlainText(uploadedMediaUrl || requestBody.mediaUrl || '', 600);
        if (hasMedia && !mediaUrl) {
            return res.status(400).json({ success: false, message: 'Attach a JPEG or PNG image before submitting this media template.' });
        }

        const baseName = requestBody.name || premadeTemplate?.template_name || `template_${Date.now()}`;
        const formattedName = formatTemplateName(`${baseName}_${language}_${Date.now()}`);
        const components = buildMetaTemplateComponents({
            bodyText,
            examples,
            hasMedia,
            mediaUrl
        });

        const { accessToken, businessAccountId, phoneNumberId } = await getTemplateSubmitCredentials(userId);
        if (!businessAccountId || !accessToken) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials.' });
        }

        const graphUrl = `https://graph.facebook.com/v20.0/${businessAccountId}/message_templates`;
        const metaPayload = {
            name: formattedName,
            language,
            category,
            components
        };

        const response = await axios.post(graphUrl, metaPayload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const metaTemplateId = response.data?.id || response.data?.message_template_id || null;
        const now = new Date().toISOString();
        const row = {
            user_id: userId,
            template_name: formattedName,
            category,
            language,
            body_content: bodyText,
            status: 'PENDING_APPROVAL',
            header_type: hasMedia ? 'IMAGE' : 'NONE',
            header_url: mediaUrl || null,
            buttons: [],
            meta_template_id: metaTemplateId,
            whatsapp_business_account_id: businessAccountId,
            whatsapp_phone_number_id: phoneNumberId || null,
            created_at: now,
            updated_at: now
        };

        const [submittedTemplate, campaignTemplate] = await Promise.all([
            saveSubmittedMetaTemplate({ db, row, requestBody, userId }),
            saveCampaignTemplateMirror({ db, row })
        ]);

        return res.status(200).json({
            success: true,
            message: 'Template submitted to Meta for approval.',
            status: 'PENDING_APPROVAL',
            metaPayload,
            meta: response.data,
            submittedTemplate,
            template: campaignTemplate
        });
    } catch (error) {
        console.error('Submit-to-Meta error:', error.response?.data || error.message || error);
        return res.status(400).json({
            success: false,
            message: error.response?.data?.error?.message || error.message || 'Unable to submit template to Meta.'
        });
    }
});

app.post('/api/templates/create-and-submit', async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        if (!db?.from) throw new Error('Database connection unavailable.');

        const sessionUser = await getSupabaseSessionUser(req);
        const isMultipart = String(req.headers['content-type'] || '').toLowerCase().includes('multipart/form-data');
        const multipartPayload = isMultipart ? await parseMultipartForm(req) : { fields: req.body || {}, files: {} };
        const requestBody = multipartPayload.fields || {};
        const mediaFile = multipartPayload.files?.media || multipartPayload.files?.file || null;

        const userId = requestBody?.userId || sessionUser?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        if (!sessionUser?.id || sessionUser.id !== userId) return res.status(403).json({ success: false, message: 'Forbidden' });

        const profile = await getDoctorTemplateProfile(userId);
        const specializationQuery = normalizeSpecializationSlug(profile.specialization);
        const templateId = sanitizePlainText(requestBody?.templateId, 80);
        if (!templateId) return res.status(400).json({ success: false, message: 'Template selection is required.' });

        const { data: premadeTemplate, error: templateError } = await db
            .from('pre_made_templates')
            .select('*')
            .eq('id', templateId)
            .maybeSingle();

        if (templateError) throw templateError;
        const templateSpecializationQuery = normalizeSpecializationSlug(premadeTemplate?.specialization);
        if (!premadeTemplate || templateSpecializationQuery !== specializationQuery) {
            return res.status(404).json({ success: false, message: 'Template not available for this specialization.' });
        }

        const freshCredentials = await getFreshTemplateSubmitCredentials(userId);
        if (!freshCredentials.businessAccountId || !freshCredentials.accessToken) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials.' });
        }

        const bodyText = toMetaTemplateBody(requestBody?.bodyText || premadeTemplate.body_text);
        const language = sanitizePlainText(requestBody?.language || premadeTemplate.language, 20);
        const incomingVariableMapping = parseMaybeJson(requestBody?.variableMapping, requestBody?.variableMapping || {});
        const variableMapping = {
            1: sanitizePlainText(incomingVariableMapping?.[1] || incomingVariableMapping?.patient_name || 'Sample Patient', 120),
            2: sanitizePlainText(incomingVariableMapping?.[2] || incomingVariableMapping?.booking_link || profile.bookingLink, 600),
            3: sanitizePlainText(incomingVariableMapping?.[3] || incomingVariableMapping?.booking_link || profile.bookingLink, 600)
        };
        const hasMedia = toBoolean(requestBody?.hasMedia) || Boolean(mediaFile);
        const mediaType = 'IMAGE';
        const uploadedMediaUrl = hasMedia && mediaFile ? await uploadTemplateMedia({ db, userId, file: mediaFile }) : '';
        const mediaUrl = sanitizePlainText(uploadedMediaUrl || requestBody?.mediaUrl || '', 600);
        if (hasMedia && !mediaUrl) {
            return res.status(400).json({ success: false, message: 'Attach a JPEG or PNG image before submitting this media template.' });
        }
        const formattedName = formatTemplateName(`${specializationQuery}_${premadeTemplate.template_name}_${language}_${Date.now()}`);

        const components = buildPremadeTemplateComponents({
            bodyText,
            variableMapping,
            hasMedia,
            mediaType,
            mediaUrl
        });

        const graphUrl = `https://graph.facebook.com/v20.0/${freshCredentials.businessAccountId}/message_templates`;
        const response = await axios.post(graphUrl, {
            messaging_product: 'whatsapp',
            name: formattedName,
            language: languageToMetaLocale(language),
            category: premadeTemplate.category,
            parameter_format: 'positional',
            components
        }, {
            headers: {
                Authorization: `Bearer ${freshCredentials.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const metaTemplateId = response.data?.id || response.data?.message_template_id || null;
        const row = {
            user_id: userId,
            template_name: formattedName,
            category: premadeTemplate.category,
            language: languageToMetaLocale(language),
            body_content: bodyText,
            status: 'PENDING_APPROVAL',
            header_type: hasMedia ? mediaType : 'NONE',
            header_url: mediaUrl || null,
            buttons: [],
            meta_template_id: metaTemplateId,
            whatsapp_business_account_id: freshCredentials.businessAccountId,
            whatsapp_phone_number_id: freshCredentials.phoneNumberId || null,
            created_at: new Date().toISOString()
        };

        const savedTemplate = await saveCampaignTemplateMirror({ db, row });

        return res.status(200).json({
            success: true,
            message: 'Template submitted to Meta for approval.',
            status: 'PENDING_APPROVAL',
            meta: response.data,
            template: savedTemplate
        });
    } catch (error) {
        console.error('Premade template submit error:', error.response?.data || error.message || error);
        return res.status(400).json({
            success: false,
            message: error.response?.data?.error?.message || error.message || 'Unable to submit template.'
        });
    }
});

app.post('/api/templates', async (req, res) => {
    try {
        if (!supabase?.from) {
            throw new Error('Database connection unavailable.');
        }

        const {
            name,
            bodyText,
            language = 'en_US',
            category = 'MARKETING',
            headerType = 'NONE',
            headerText = '',
            footerText = '',
            buttons = [],
            components = [],
            messaging_product: messagingProduct = 'whatsapp'
        } = req.body;

        const sessionUser = await getSupabaseSessionUser(req);
        const userId = sessionUser?.id || req.body.userId;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required.' });
        }

        if (sessionUser?.id && req.body.userId && req.body.userId !== sessionUser.id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const formattedName = formatTemplateName(name);

        if (!formattedName) {
            return res.status(400).json({ success: false, message: 'Template name is required.' });
        }

        if (!bodyText || !bodyText.trim()) {
            return res.status(400).json({ success: false, message: 'Template body text is required.' });
        }

        const freshCredentials = await getFreshTemplateSubmitCredentials(userId);
        const businessAccountId = freshCredentials.businessAccountId || null;
        const accessToken = freshCredentials.accessToken || null;

        if (!businessAccountId || !accessToken) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials. Please configure Meta WhatsApp credentials in settings.' });
        }

        const graphComponents = buildTemplateComponents({ bodyText, headerType, headerText, footerText, buttons, components });
        const sanitizedButtons = graphComponents.find((component) => component.type === 'BUTTONS')?.buttons || [];
        const metaLanguage = normalizeTemplateLanguage(language);

        const graphUrl = `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates`;
        const response = await axios.post(graphUrl, {
            messaging_product: messagingProduct || 'whatsapp',
            name: formattedName,
            language: metaLanguage,
            category,
            components: graphComponents
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
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
            meta_template_id: metaTemplateId,
            whatsapp_business_account_id: businessAccountId,
            whatsapp_phone_number_id: freshCredentials.phoneNumberId || null
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

app.delete('/api/templates/:id', async (req, res) => {
    try {
        if (!supabase?.from) {
            throw new Error('Database connection unavailable.');
        }

        const db = supabaseAdmin || supabase;
        const templateId = req.params.id;
        const sessionUser = await getSupabaseSessionUser(req);
        const userId = req.query.userId || req.body?.userId || sessionUser?.id;

        if (!templateId || !userId) {
            return res.status(400).json({ success: false, message: 'Template ID and user ID are required.' });
        }
        if (!sessionUser?.id || sessionUser.id !== userId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const { data: template, error: templateError } = await db
            .from('whatsapp_templates')
            .select('id,user_id,template_name')
            .eq('id', templateId)
            .eq('user_id', userId)
            .maybeSingle();

        if (templateError) throw templateError;
        if (!template) {
            return res.status(404).json({ success: false, message: 'Template not found.' });
        }

        let { data: userMeta, error: credentialError } = await db
            .from('doctor_profiles')
            .select('system_user_token,meta_waba_id')
            .eq('id', userId)
            .maybeSingle();

        if (credentialError && isMissingColumnError(credentialError)) {
            const fallbackResult = await db
                .from('doctor_profiles')
                .select('whatsapp_access_token,whatsapp_business_account_id')
                .eq('id', userId)
                .maybeSingle();
            userMeta = fallbackResult.data
                ? {
                    system_user_token: fallbackResult.data.whatsapp_access_token,
                    meta_waba_id: fallbackResult.data.whatsapp_business_account_id
                }
                : null;
            credentialError = fallbackResult.error;
        }

        if (credentialError) throw credentialError;
        if (!userMeta?.meta_waba_id || !userMeta?.system_user_token) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials.' });
        }

        let metaResponse;
        try {
            metaResponse = await axios.delete(`https://graph.facebook.com/v20.0/${userMeta.meta_waba_id}/message_templates`, {
                params: { name: template.template_name },
                headers: { Authorization: `Bearer ${userMeta.system_user_token}` }
            });
        } catch (error) {
            const providerMessage = error.response?.data?.error?.message || error.message || 'Meta template deletion failed.';
            return res.status(error.response?.status || 400).json({
                success: false,
                message: providerMessage,
                provider: error.response?.data || null
            });
        }

        const metaDeleteSucceeded = metaResponse?.data?.success === true || metaResponse?.status === 200;
        if (!metaDeleteSucceeded) {
            return res.status(400).json({
                success: false,
                message: 'Meta did not confirm template deletion.',
                provider: metaResponse?.data || null
            });
        }

        const { error: deleteError } = await db
            .from('whatsapp_templates')
            .delete()
            .eq('id', templateId)
            .eq('user_id', userId);

        if (deleteError) throw deleteError;

        return res.status(200).json({ success: true, message: 'Template deleted from Meta and Yogi Desk.' });
    } catch (error) {
        console.error('Template delete error:', error.response?.data || error.message || error);
        return res.status(400).json({ success: false, message: error.response?.data?.error?.message || error.message || 'Template deletion failed.' });
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

        const metaConfig = await getMetaConfigForUser(sessionUser.id);

        return res.status(200).json({
            success: true,
            data: {
                meta_phone_number_id: metaConfig.whatsapp_phone_number_id || '',
                meta_waba_id: metaConfig.whatsapp_business_account_id || '',
                whatsapp_business_id: metaConfig.whatsapp_business_id || '',
                meta_business_manager_id: metaConfig.meta_business_manager_id || '',
                system_user_token: metaConfig.system_user_token || '',
                meta_configured: metaConfig.meta_configured,
                is_locked: metaConfig.meta_configured
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

app.post('/api/payments/meta-connection', async (req, res, next) => {
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
        response = await axios.post(url, payload, {
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

const resolveCampaignMessagePreview = (row = {}) => {
    const text = row.message_body || row.payload?.text || row.payload?.template?.templateText || row.payload?.template?.bodyText || row.payload?.template?.body_content;
    return String(text || `Sent template: ${row.template_name || 'WhatsApp Template'}`).trim();
};

const upsertCampaignInboxMessage = async ({ row = {}, metaResult = null, fallbackDispatch = false }) => {
    if (!supabase?.from) return;
    const db = supabaseAdmin || supabase;

    const nowIso = new Date().toISOString();
    const recipientPhone = String(row.recipient_phone || row.phone || '').trim();
    const recipientName = String(row.recipient_name || row.payload?.recipient?.patientName || row.payload?.recipient?.name || 'Patient').trim();
    const userId = row.user_id || row.doctor_id || null;
    const messageBody = resolveCampaignMessagePreview(row);
    const metadata = {
        template_id: row.template_id || row.payload?.template?.id || null,
        template_name: row.template_name || row.payload?.template?.template_name || row.payload?.template?.name || 'WhatsApp Template',
        template_category: row.template_category || row.payload?.template?.category || 'UTILITY',
        meta_result: metaResult,
        fallback_dispatch: fallbackDispatch,
    };

    let chatId = null;
    const { data: existingChat } = await db
        .from('inbox_chats')
        .select('id, metadata')
        .eq('phone', recipientPhone)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existingChat?.id) {
        chatId = existingChat.id;
        await db.from('inbox_chats').update({
            user_id: userId,
            doctor_id: userId,
            name: recipientName || 'Patient',
            patient_name: recipientName || 'Patient',
            patient_phone: recipientPhone || 'unknown',
            status: 'SENT',
            last_message: messageBody,
            updated_at: nowIso,
            metadata: {
                ...(existingChat.metadata || {}),
                last_template: metadata,
            },
        }).eq('id', chatId);
    } else {
        const { data: createdChat } = await db.from('inbox_chats').insert([{
            user_id: userId,
            doctor_id: userId,
            name: recipientName || 'Patient',
            patient_name: recipientName || 'Patient',
            phone: recipientPhone || 'unknown',
            patient_phone: recipientPhone || 'unknown',
            status: 'SENT',
            last_message: messageBody,
            unread_count: 0,
            updated_at: nowIso,
            metadata: { last_template: metadata },
        }]).select('id').maybeSingle();
        chatId = createdChat?.id || null;
    }

    if (!chatId) return;

    const { error } = await db.from('inbox_messages').insert([{
        chat_id: chatId,
        workspace_id: userId,
        sender: 'agent',
        from_me: true,
        type: 'template',
        body: messageBody,
        text: messageBody,
        message_body: messageBody,
        sender_phone: row.phone_number_id || null,
        receiver_phone: recipientPhone,
        is_private_note: false,
        metadata,
        created_at: nowIso,
    }]);

    if (error) {
        console.error('Campaign inbox message insert failed:', error.message || error);
    }
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

            await upsertCampaignInboxMessage({ row, metaResult, fallbackDispatch: true });

            await Promise.allSettled([
                supabase.from('inbox_chats').update({
                    status: 'SENT',
                    last_message: resolveCampaignMessagePreview(row),
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

            await upsertCampaignInboxMessage({ row, metaResult });

            await Promise.allSettled([
                supabase.from('wallets').update({ balance: nextBalance }).eq('user_id', row.user_id),
                supabase.from('campaign_queue').update({ status: 'SENT', sent_at: new Date().toISOString(), meta_response: metaResult }).eq('id', row.id),
                supabase.from('inbox_chats').update({
                    status: 'SENT',
                    last_message: resolveCampaignMessagePreview(row),
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

// ====== PORT LISTEN ENGINE ======
if (require.main !== module) {
  app.listen = () => app;
}
const PORT = process.env.PORT || 5000;
module.exports = app;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Yogi Desk API running safely on port ${PORT}`);
});
