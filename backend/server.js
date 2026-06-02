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
const adminControlRoutes = require('./routes/adminControlRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { startMetaSyncWorker, stopMetaSyncWorker } = require('./services/metaSyncWorker');
const { getMetaMessageId, processFailedDeliveryRefund } = require('./services/refundService');
const {
    activateSubscriptionTier,
    ensurePremiumTrialProfile,
    startTrialReminderJob
} = require('./services/trialService');

const app = express();

const isMetaWebhookRequestPath = (url = '') => (
    String(url || '').startsWith('/api/webhooks/whatsapp') ||
    String(url || '').startsWith('/api/whatsapp-webhook') ||
    String(url || '').startsWith('/api/webhook/meta')
);

const CORS_ALLOWED_METHODS = 'GET, POST, OPTIONS, PUT, PATCH, DELETE';
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-Hub-Signature-256';
const CORS_ALLOWED_ORIGINS = new Set([
    'https://yogidesk-ai.com',
    'http://yogidesk-ai.com',
    'http://localhost:5173'
]);
const resolveCorsOrigin = (origin) => (
    origin && CORS_ALLOWED_ORIGINS.has(origin)
        ? origin
        : 'https://yogidesk-ai.com'
);
const corsOptions = {
    origin: (origin, callback) => callback(null, resolveCorsOrigin(origin)),
    methods: CORS_ALLOWED_METHODS,
    allowedHeaders: CORS_ALLOWED_HEADERS,
    credentials: true,
    optionsSuccessStatus: 204
};

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', resolveCorsOrigin(req.headers.origin));
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({
    verify: (req, res, buf) => {
        if (isMetaWebhookRequestPath(req.originalUrl || req.url)) {
            req.rawBody = Buffer.from(buf || '').toString('utf8');
        }
    }
}));
app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    return res.status(200).json({ success: true, message: "Yogi Desk API Service Online" });
});
// Yeh line frontend ki saari HTML/CSS/JS files ko automatic utha legi
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminControlRoutes);

const PLAN_CONTACT_LIMITS = { starter: 500, growth: 2000, hospital: 10000 };
const RATE_CARD = { UTILITY: 0.20, MARKETING: 1.30, AUTHENTICATION: 0.20 };
const normalizeTier = (tier = 'starter') => String(tier).toLowerCase().split(' ')[0];
const normalizePhone = (phone) => String(phone || '').replace(/[^\d+]/g, '');
const phoneDigitsOnly = (value) => String(value || '').replace(/\D/g, '');
const getPhoneMatchParts = (value) => {
    const digits = phoneDigitsOnly(value);
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
        suffixes: Array.from(suffixes).filter(Boolean)
    };
};
const buildPhoneOrFilter = (columns = [], value) => {
    const { suffixes, variants } = getPhoneMatchParts(value);
    const filters = [];
    for (const column of columns) {
        for (const variant of variants) filters.push(`${column}.eq.${variant}`);
        for (const suffix of suffixes) filters.push(`${column}.ilike.%${suffix}`);
    }
    return filters.join(',');
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
    const digits = phoneDigitsOnly(value);
    return digits.length === 10 ? `91${digits}` : digits;
};
const sanitizeMetaId = (value) => String(value || '').trim().replace(/[^\w.-]/g, '');
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
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
        const { email, name, businessName, businessCategory, phone, userId } = req.body || {};
        if (!email) return res.status(400).json({ success: false, msg: 'Email is required' });

        if (supabaseAdmin && userId) {
            await ensurePremiumTrialProfile(supabaseAdmin, {
                userId,
                email,
                name: name || 'Doctor',
                businessName,
                businessCategory,
                phone
            }).then(({ error }) => {
                if (error) console.error('Premium trial profile seed failed:', error.message || error);
            });

            await supabaseAdmin.from('wallets').upsert({
                user_id: userId,
                balance: 50.00,
                is_first_recharge: true,
                welcome_gift_active: true,
                current_plan: 'growth',
                plan_tier: 'Growth Clinic',
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

app.get('/api/profile/trial', attachDoctorSession, async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        const userId = req.user?.id || req.query?.userId;
        if (!db?.from || !userId) return res.status(400).json({ success: false, msg: 'User ID is required.' });

        const { data, error } = await db
            .from('doctor_profiles')
            .select('id,email,name,subscription_tier,subscription_status,trial_start_at,trial_end_at,wallet_balance,onboarding_tour_completed,plan_limits')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;

        const trialEnd = data?.trial_end_at ? new Date(data.trial_end_at) : null;
        const remainingMs = trialEnd ? trialEnd.getTime() - Date.now() : null;
        return res.status(200).json({
            success: true,
            profile: data || null,
            remainingHours: remainingMs === null ? null : Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000))),
            shouldShowRetentionModal: Boolean(data && ['trialing', 'trial'].includes(String(data.subscription_status || '').toLowerCase()) && remainingMs !== null && remainingMs <= 48 * 60 * 60 * 1000 && remainingMs > 0)
        });
    } catch (error) {
        console.error('Trial profile fetch failed:', error.message || error);
        return res.status(500).json({ success: false, msg: 'Unable to load trial profile.' });
    }
});

app.post('/api/profile/onboarding-tour-complete', attachDoctorSession, async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        const userId = req.user?.id || req.body?.userId;
        if (!db?.from || !userId) return res.status(400).json({ success: false, msg: 'User ID is required.' });

        const { error } = await db
            .from('doctor_profiles')
            .update({ onboarding_tour_completed: true, updated_at: new Date().toISOString() })
            .eq('id', userId);
        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Onboarding completion failed:', error.message || error);
        return res.status(202).json({ success: false });
    }
});

app.post('/api/subscriptions/activate', attachDoctorSession, async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        const userId = req.user?.id || req.body?.userId;
        const tier = req.body?.tier;
        const paymentReference = String(req.body?.paymentReference || req.body?.txnid || '').trim();
        const paymentValidated = req.body?.paymentValidated === true || String(req.body?.status || '').toLowerCase() === 'success';

        if (!userId) return res.status(400).json({ success: false, msg: 'User ID is required.' });
        if (!paymentValidated && !paymentReference) {
            return res.status(402).json({ success: false, msg: 'Payment validation is required before subscription activation.' });
        }

        if (paymentReference) {
            const { data: paymentRecord, error: paymentLookupError } = await db
                .from('wallet_transactions')
                .select('id')
                .eq('user_id', userId)
                .or(`metadata->>txnid.eq.${paymentReference},id.eq.${paymentReference}`)
                .maybeSingle();

            if (paymentLookupError) console.warn('Subscription payment lookup skipped:', paymentLookupError.message || paymentLookupError);
            if (!paymentValidated && !paymentRecord?.id) {
                return res.status(402).json({ success: false, msg: 'Unable to validate this payment reference.' });
            }
        }

        const profile = await activateSubscriptionTier({ db, userId, tier, paymentReference });
        return res.status(200).json({ success: true, profile });
    } catch (error) {
        console.error('Subscription activation failed:', error.message || error);
        return res.status(500).json({ success: false, msg: 'Unable to activate subscription.' });
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

const updateTeamMemberActivation = async ({ memberId, authUserId }) => {
    const db = supabaseAdmin || supabase;
    let payload = {
        status: 'ACTIVE',
        auth_user_id: authUserId,
        user_id: authUserId,
        accepted_at: new Date().toISOString()
    };
    const removedColumns = new Set();

    while (Object.keys(payload).length > 0) {
        const { data, error } = await db
            .from('team_members')
            .update(payload)
            .eq('id', memberId)
            .select('id, admin_id, name, email, status')
            .maybeSingle();

        if (!error) return data;

        const missingColumn = getMissingSchemaColumn(error);
        if (missingColumn && !removedColumns.has(missingColumn)) {
            removedColumns.add(missingColumn);
            const { [missingColumn]: _removed, ...nextPayload } = payload;
            payload = nextPayload;
            continue;
        }

        throw error;
    }

    throw new Error('Unable to activate team member.');
};

app.post('/api/team/setup-password', async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        if (!db?.from || !db?.auth?.admin?.createUser) {
            return res.status(500).json({ success: false, message: 'Team setup service is unavailable.' });
        }

        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || '');

        if (!email) return res.status(400).json({ success: false, message: 'Invite email is required.' });
        if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

        const { data: member, error: memberError } = await db
            .from('team_members')
            .select('id, admin_id, name, email, status, invite_expires_at')
            .eq('email', email)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (memberError) throw memberError;
        if (!member) return res.status(404).json({ success: false, message: 'Invite not found for this email.' });

        if (String(member.status || '').toUpperCase() !== 'PENDING') {
            return res.status(409).json({ success: false, message: 'This invite is no longer pending.' });
        }

        if (member.invite_expires_at && new Date(member.invite_expires_at).getTime() <= Date.now()) {
            await db.from('team_members').update({ status: 'EXPIRED' }).eq('id', member.id);
            return res.status(410).json({ success: false, message: 'This invite has expired. Please ask your admin to send a new invite.' });
        }

        const { data: authUser, error: authError } = await db.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: 'STAFF',
                account_role: 'STAFF',
                staff_name: member.name || email,
                name: member.name || email,
                admin_id: member.admin_id || null
            }
        });

        if (authError) {
            const message = String(authError.message || '').toLowerCase();
            if (message.includes('already') || message.includes('registered')) {
                return res.status(409).json({ success: false, message: 'An account already exists for this email. Please use login or request a fresh invite.' });
            }
            throw authError;
        }

        const createdUserId = authUser?.user?.id;
        if (!createdUserId) throw new Error('Supabase did not return a created auth user.');

        const updatedMember = await updateTeamMemberActivation({
            memberId: member.id,
            authUserId: createdUserId
        });

        return res.status(200).json({
            success: true,
            userId: createdUserId,
            member: updatedMember
        });
    } catch (error) {
        console.error('Team setup password error:', error.message || error);
        return res.status(500).json({ success: false, message: error.message || 'Unable to complete staff setup.' });
    }
});

app.get('/api/team/session-role', async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        if (!db?.from) return res.status(500).json({ success: false, message: 'Database connection unavailable.' });

        const userId = String(req.query.userId || '').trim();
        const email = normalizeEmail(req.query.email);
        if (!userId && !email) return res.status(400).json({ success: false, message: 'User id or email is required.' });

        let member = null;
        const selectColumns = 'id, admin_id, name, email, status, auth_user_id, user_id';

        if (userId) {
            let result = await db
                .from('team_members')
                .select(selectColumns)
                .eq('auth_user_id', userId)
                .eq('status', 'ACTIVE')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (result.error && getMissingSchemaColumn(result.error)) {
                result = await db
                    .from('team_members')
                    .select('id, admin_id, name, email, status')
                    .eq('email', email)
                    .eq('status', 'ACTIVE')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
            }
            if (result.error && !getMissingSchemaColumn(result.error)) throw result.error;
            member = result.data || null;
        }

        if (!member && email) {
            const { data, error } = await db
                .from('team_members')
                .select('id, admin_id, name, email, status')
                .eq('email', email)
                .eq('status', 'ACTIVE')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            member = data || null;
        }

        if (member?.id) {
            return res.status(200).json({
                success: true,
                role: 'STAFF',
                redirectTo: '/staff/dashboard',
                member
            });
        }

        return res.status(200).json({
            success: true,
            role: 'DOCTOR',
            redirectTo: '/dashboard'
        });
    } catch (error) {
        console.error('Team session role lookup failed:', error.message || error);
        return res.status(500).json({ success: false, message: 'Unable to resolve user role.' });
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

const isMetaDeveloperTestPayload = (payload = {}) => {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.test === true || payload.sample === true || payload.is_sample === true) return true;

    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
        if (String(entry?.id || '').toLowerCase() === '0') return true;
        for (const change of entry?.changes || []) {
            const value = change?.value || {};
            const metadata = value.metadata || {};
            const metaValues = [
                metadata.display_phone_number,
                metadata.phone_number_id,
                value.display_phone_number,
                value.phone_number_id
            ].map((item) => String(item || '').toLowerCase());

            if (metaValues.some((item) => (
                item.includes('sample') ||
                item.includes('test') ||
                item.includes('phone_number_id') ||
                item.includes('display_phone_number')
            ))) {
                return true;
            }
        }
    }

    return false;
};

const getWhatsAppWebhookPayloadShape = (payload = {}) => {
    const shape = {
        isWhatsAppObject: payload?.object === 'whatsapp_business_account',
        hasMessagesField: false,
        hasStatuses: false,
        hasWamid: false
    };
    if (!shape.isWhatsAppObject || !Array.isArray(payload?.entry)) return shape;

    for (const entry of payload.entry) {
        for (const change of entry?.changes || []) {
            if (change?.field !== 'messages') continue;
            shape.hasMessagesField = true;
            const value = change?.value || {};
            const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
            const messages = Array.isArray(value?.messages) ? value.messages : [];
            if (statuses.length > 0) shape.hasStatuses = true;
            if ([...statuses, ...messages].some((row) => String(row?.id || row?.message_id || '').startsWith('wamid.'))) {
                shape.hasWamid = true;
            }
        }
    }

    return shape;
};

const canTemporarilyBypassMetaSignature = (payload = {}) => {
    const shape = getWhatsAppWebhookPayloadShape(payload);
    if (shape.hasStatuses) return true;
    return process.env.NODE_ENV === 'production' && shape.isWhatsAppObject && shape.hasMessagesField && shape.hasWamid;
};

const hasValidWhatsAppWebhookPayloadStructure = (payload = {}) => {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.object !== 'whatsapp_business_account') return false;
    if (!Array.isArray(payload.entry) || payload.entry.length === 0) return false;

    return payload.entry.some((entry) => (
        Array.isArray(entry?.changes) &&
        entry.changes.some((change) => change?.field && change?.value && typeof change.value === 'object')
    ));
};

const verifyMetaWebhookSignature = (req) => {
    const appSecret = getMetaWebhookAppSecret();
    const signature = String(req.get('x-hub-signature-256') || '').trim();
    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : '';

    if (!appSecret) return true;
    if (!rawBody || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;

    const expected = `sha256=${crypto
        .createHmac('sha256', appSecret)
        .update(rawBody, 'utf8')
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

const extractFailedDeliveryUpdates = (payload = {}) => {
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];

    const updates = [];
    for (const entry of payload.entry) {
        if (!Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
            if (change.field !== 'messages') continue;
            const value = change.value || {};
            const statuses = Array.isArray(value.statuses) ? value.statuses : [];

            for (const statusRow of statuses) {
                const status = String(statusRow.status || '').toLowerCase();
                if (status !== 'failed') continue;

                const metadata = statusRow.metadata || value.metadata || {};
                const template = statusRow.template || metadata.template || {};
                const pricing = statusRow.pricing || {};
                const conversation = statusRow.conversation || {};
                const messageId = statusRow.id || statusRow.message_id || null;
                if (!messageId) continue;

                updates.push({
                    userId: metadata.user_id || metadata.doctor_id || value.user_id || null,
                    messageId,
                    templateCategory: pricing.category || metadata.template_category || metadata.category || template.category || null,
                    templateName: metadata.template_name || template.name || null,
                    templateId: metadata.template_id || template.id || conversation.id || null,
                    reason: statusRow.errors?.[0]?.title || statusRow.errors?.[0]?.message || 'Delivery Failed / Undelivered Number',
                    status
                });
            }
        }
    }

    return updates;
};

const processFailedDeliveryWebhook = async (payload = {}) => {
    for (const update of extractFailedDeliveryUpdates(payload)) {
        await processFailedDeliveryRefund({
            userId: update.userId,
            messageId: update.messageId,
            templateCategory: update.templateCategory,
            templateName: update.templateName,
            templateId: update.templateId,
            reason: update.reason,
            source: 'meta_webhook',
            rawStatus: update.status
        });
    }
};

const quotePostgrestValue = (value) => {
    const clean = String(value || '').trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${clean}"`;
};

const isMissingStatusMatchColumn = (error) => {
    const message = String(error?.message || error?.details || '').toLowerCase();
    return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const getDeliveryStatusRank = (status) => ({
    SENT: 1,
    DELIVERED: 2,
    READ: 3,
    FAILED: 4
}[String(status || '').trim().toUpperCase()] || 0);

const extractMessageStatusUpdates = (payload = {}) => {
    try {
        const updates = [];
        for (const entry of payload?.entry || []) {
            for (const change of entry?.changes || []) {
                if (change?.field !== 'messages') continue;
                const value = change?.value || {};
                const statuses = Array.isArray(value?.statuses) ? value.statuses : [];
                const valueMetadata = value?.metadata || {};

                for (const statusObj of statuses) {
                    const incomingWamid = String(statusObj?.id || statusObj?.message_id || '').trim();
                    const rawStatus = String(statusObj?.status || '').trim().toUpperCase();
                    if (!incomingWamid || !rawStatus) continue;

                    updates.push({
                        messageId: incomingWamid,
                        status: rawStatus,
                        timestamp: statusObj.timestamp || null,
                        recipientPhone: sanitizeMetaPhoneNumber(statusObj.recipient_id || ''),
                        businessAccountId: sanitizeMetaId(valueMetadata.whatsapp_business_account_id || valueMetadata.waba_id || entry.id || ''),
                        phoneNumberId: sanitizeMetaId(valueMetadata.phone_number_id || ''),
                        displayPhoneNumber: sanitizeMetaPhoneNumber(valueMetadata.display_phone_number || ''),
                        error: statusObj.errors?.[0] || null,
                        raw: statusObj
                    });
                }
            }
        }
        return updates;
    } catch (error) {
        console.error('WhatsApp status payload extraction failed:', error.message || error);
        return [];
    }
};

const updateInboxMessagesByWamid = async (db, update) => {
    const patch = { status: update.status };
    const incomingWamid = String(update.messageId || '').trim();
    const quotedWamid = quotePostgrestValue(incomingWamid);
    console.log("Processing Webhook for WAMID:", incomingWamid, "New Status:", update.status);

    const runStatusUpdate = async (buildQuery) => {
        let query = buildQuery(db.from('inbox_messages').update(patch));
        const statusRank = getDeliveryStatusRank(update.status);
        if (statusRank <= getDeliveryStatusRank('SENT')) query = query.not('status', 'in', '("DELIVERED","READ","FAILED")');
        if (statusRank === getDeliveryStatusRank('DELIVERED')) query = query.not('status', 'in', '("READ","FAILED")');
        if (statusRank === getDeliveryStatusRank('READ')) query = query.neq('status', 'FAILED');
        return query.select('id, chat_id, metadata');
    };

    const attempts = [
        () => runStatusUpdate((query) => query.or(`meta_message_id.ilike.${quotedWamid},message_id.ilike.${quotedWamid}`)),
        () => runStatusUpdate((query) => query.filter('metadata->>meta_message_id', 'eq', incomingWamid)),
        () => runStatusUpdate((query) => query.filter('metadata->>message_id', 'eq', incomingWamid)),
        () => runStatusUpdate((query) => query.filter('metadata->>wamid', 'eq', incomingWamid)),
        () => runStatusUpdate((query) => query.ilike('wamid', incomingWamid))
    ];

    let lastResult = { data: [], error: null };
    for (const attempt of attempts) {
        const result = await attempt();
        if (result.error) {
            if (isMissingStatusMatchColumn(result.error)) {
                continue;
            }
            return result;
        }
        if (Array.isArray(result.data) && result.data.length > 0) return result;
        lastResult = result;
    }

    console.warn('Inbox delivery status update matched no WAMID rows after all lookup strategies:', {
        incomingWamid,
        status: update.status
    });
    return lastResult;
};

const logWhatsAppWebhookStatusEvent = async (db, update, messages = [], processingError = null) => {
    if (!db?.from || !update?.messageId) return;
    try {
        const matchedMessages = Array.isArray(messages) ? messages : [];
        const { error } = await db.from('whatsapp_webhook_events').insert([{
            source: 'express_whatsapp_webhook',
            message_id: update.messageId,
            status: update.status,
            recipient_phone: update.recipientPhone || null,
            business_account_id: update.businessAccountId || null,
            phone_number_id: update.phoneNumberId || null,
            display_phone_number: update.displayPhoneNumber || null,
            matched_message_count: matchedMessages.length,
            matched_chat_ids: matchedMessages.map((message) => message.chat_id).filter(Boolean),
            processing_error: processingError ? String(processingError.message || processingError) : null,
            payload: update.raw || null
        }]);
        if (error && !isMissingStatusMatchColumn(error)) {
            console.error('WhatsApp webhook status event log failed:', error.message || error);
        }
    } catch (error) {
        console.error('WhatsApp webhook status event log crashed:', error.message || error);
    }
};

const logRawWhatsAppWebhookHit = async (payload = {}, { fields = [], statusCount = 0, incomingCount = 0 } = {}) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from) return;
    try {
        const { error } = await db.from('whatsapp_webhook_events').insert([{
            source: 'express_whatsapp_webhook',
            message_id: null,
            status: 'WEBHOOK_POST',
            matched_message_count: 0,
            matched_chat_ids: [],
            processing_error: null,
            payload: {
                object: payload?.object || null,
                fields,
                status_count: statusCount,
                incoming_count: incomingCount,
                entry_count: Array.isArray(payload?.entry) ? payload.entry.length : 0,
                raw: payload
            }
        }]);
        if (error && !isMissingStatusMatchColumn(error)) {
            console.error('WhatsApp raw webhook hit log failed:', error.message || error);
        }
    } catch (error) {
        console.error('WhatsApp raw webhook hit log crashed:', error.message || error);
    }
};

const logWhatsAppInboundWebhookEvent = async (db, incoming, { userId = null, chatId = null, inserted = false, processingError = null } = {}) => {
    if (!db?.from || !incoming?.messageId) return;
    try {
        const { error } = await db.from('whatsapp_webhook_events').insert([{
            source: 'express_whatsapp_webhook',
            message_id: incoming.messageId,
            status: 'INBOUND',
            recipient_phone: incoming.fromPhone || null,
            business_account_id: incoming.businessAccountId || null,
            phone_number_id: incoming.phoneNumberId || null,
            display_phone_number: incoming.displayPhoneNumber || null,
            matched_message_count: inserted ? 1 : 0,
            matched_chat_ids: chatId ? [chatId] : [],
            processing_error: processingError ? String(processingError.message || processingError) : null,
            payload: {
                ...(incoming.raw || {}),
                resolved_user_id: userId,
                resolved_chat_id: chatId,
                text_preview: incoming.text
            }
        }]);
        if (error && !isMissingStatusMatchColumn(error)) {
            console.error('WhatsApp inbound webhook event log failed:', error.message || error);
        }
    } catch (error) {
        console.error('WhatsApp inbound webhook event log crashed:', error.message || error);
    }
};

const scheduleInboxDeliveryStatusRetry = (update = {}) => {
    const retryAttempt = Number(update.retryAttempt || 0);
    const retryDelays = [700, 2000, 5000, 10000];
    const delay = retryDelays[retryAttempt];
    if (!delay) return;

    setTimeout(() => {
        applyInboxDeliveryStatusUpdate({ ...update, retryAttempt: retryAttempt + 1 })
            .catch((error) => console.error('Inbox delivery status retry failed:', error.message || error));
    }, delay);
};

const applyInboxDeliveryStatusUpdate = async (update = {}) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from) return;

    try {
        const { data: messages, error } = await updateInboxMessagesByWamid(db, update);
        await logWhatsAppWebhookStatusEvent(db, update, messages || [], error || null);

        if (error) {
            console.error('❌ Inbox delivery status WAMID update failed:', {
                messageId: update.messageId,
                status: update.status,
                retryAttempt: update.retryAttempt || 0,
                error: error.message || error
            });
            return;
        }

        console.log('✅ Inbox delivery status updated:', {
            messageId: update.messageId,
            status: update.status,
            retryAttempt: update.retryAttempt || 0,
            matchedRows: Array.isArray(messages) ? messages.length : 0
        });

        if (!Array.isArray(messages) || messages.length === 0) {
            console.warn('Inbox delivery status WAMID update matched no rows:', {
                messageId: update.messageId,
                status: update.status,
                retryAttempt: update.retryAttempt || 0
            });
            scheduleInboxDeliveryStatusRetry(update);
            return;
        }

        for (const message of messages || []) {
            const nextMetadata = {
                ...(message.metadata || {}),
                meta_message_id: update.messageId,
                message_id: update.messageId,
                delivery_status: update.status,
                delivery_status_at: update.timestamp,
                delivery_error: update.error,
                whatsapp_business_account_id: update.businessAccountId || message.metadata?.whatsapp_business_account_id || null,
                whatsapp_phone_number_id: update.phoneNumberId || message.metadata?.whatsapp_phone_number_id || null,
                display_phone_number: update.displayPhoneNumber || message.metadata?.display_phone_number || null,
                last_meta_status: update.raw
            };

            const { error: updateError } = await db
                .from('inbox_messages')
                .update({
                    status: update.status,
                    metadata: nextMetadata
                })
                .eq('id', message.id);

            if (updateError) {
                console.error('Inbox delivery status update failed:', updateError.message || updateError);
                continue;
            }

            if (message.chat_id) {
                const { data: chat } = await db
                    .from('inbox_chats')
                    .select('metadata')
                    .eq('id', message.chat_id)
                    .maybeSingle();
                const chatMetadata = chat?.metadata || {};
                const chatPatch = {
                    status: update.status,
                    updated_at: new Date().toISOString(),
                    metadata: {
                        ...chatMetadata,
                        meta_message_id: update.messageId,
                        delivery_status: update.status,
                        whatsapp_business_account_id: update.businessAccountId || chatMetadata.whatsapp_business_account_id || null,
                        subscription_status: 'ACTIVE',
                        last_template: {
                            ...(chatMetadata.last_template || {}),
                            meta_message_id: update.messageId,
                            message_id: update.messageId,
                            delivery_status: update.status,
                            delivery_status_at: update.timestamp,
                            whatsapp_business_account_id: update.businessAccountId || chatMetadata.last_template?.whatsapp_business_account_id || null
                        }
                    }
                };
                if (update.status === 'READ') chatPatch.unread_count = 0;

                await db
                    .from('inbox_chats')
                    .update(chatPatch)
                    .eq('id', message.chat_id);
            }
        }
    } catch (error) {
        await logWhatsAppWebhookStatusEvent(db, update, [], error);
        console.error('Inbox delivery status sync failed:', error.message || error);
    }
};

const updateInboxMessageDeliveryStatuses = async (payload = {}) => {
    const updates = extractMessageStatusUpdates(payload);
    console.log("=== WEBHOOK STATUS UPDATES RECEIVED ===", {
        totalUpdates: updates.length,
        updates: updates.map(u => ({ messageId: u.messageId, status: u.status }))
    });

    for (const update of updates) {
        await applyInboxDeliveryStatusUpdate(update);
    }
};

const extractIncomingInboxMessages = (payload = {}) => {
    if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return [];

    const messages = [];
    for (const entry of payload.entry) {
        if (!Array.isArray(entry.changes)) continue;

        for (const change of entry.changes) {
            if (change.field !== 'messages') continue;
            const value = change.value || {};
            const metadata = value.metadata || {};
            const businessAccountId = sanitizeMetaId(metadata.whatsapp_business_account_id || metadata.waba_id || entry.id || '');
            const contactsByWaId = new Map((value.contacts || []).map((contact) => [String(contact.wa_id || ''), contact]));

            for (const message of value.messages || []) {
                const fromPhone = sanitizeMetaPhoneNumber(message.from || '');
                const contact = contactsByWaId.get(String(message.from || '')) || {};
                const text = message.text?.body ||
                    message.button?.text ||
                    message.interactive?.button_reply?.title ||
                    message.interactive?.list_reply?.title ||
                    message.image?.caption ||
                    message.document?.caption ||
                    'Media/Unsupported Message';

                if (!fromPhone) continue;
                messages.push({
                    messageId: message.id || null,
                    fromPhone,
                    clinicMetaId: sanitizeMetaPhoneNumber(metadata.phone_number_id || metadata.display_phone_number || ''),
                    businessAccountId,
                    phoneNumberId: sanitizeMetaId(metadata.phone_number_id || ''),
                    displayPhoneNumber: sanitizeMetaPhoneNumber(metadata.display_phone_number || ''),
                    patientName: contact.profile?.name || 'Patient',
                    text: String(text || 'Media/Unsupported Message').trim(),
                    raw: message
                });
            }
        }
    }

    return messages;
};

const resolveInboxOwnerForIncoming = async ({ clinicMetaId, businessAccountId, patientPhone }) => {
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
        if (error) console.warn('Incoming webhook owner lookup by WABA failed:', error.message || error);
    }

    if (clinicMetaId) {
        const { data, error } = await db
            .from('doctor_profiles')
            .select('id')
            .or(`meta_phone_number_id.eq.${clinicMetaId},whatsapp_phone_number_id.eq.${clinicMetaId}`)
            .limit(1)
            .maybeSingle();

        if (data?.id) return data.id;
        if (error) console.warn('Incoming webhook owner lookup by Meta phone failed:', error.message || error);
    }

    if (patientPhone) {
        const phoneFilter = buildPhoneOrFilter(['phone', 'patient_phone'], patientPhone);
        const { data, error } = await db
            .from('inbox_chats')
            .select('user_id, doctor_id')
            .or(phoneFilter)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (data?.user_id || data?.doctor_id) return data.user_id || data.doctor_id;
        if (error) console.warn('Incoming webhook owner lookup by patient phone failed:', error.message || error);
    }

    return null;
};

const processIncomingInboxMessagesWebhook = async (payload = {}) => {
    const db = supabaseAdmin || supabase;
    if (!db?.from) return;

    for (const incoming of extractIncomingInboxMessages(payload)) {
        try {
            const userId = await resolveInboxOwnerForIncoming({
                clinicMetaId: incoming.clinicMetaId,
                businessAccountId: incoming.businessAccountId,
                patientPhone: incoming.fromPhone
            });
            if (!userId) {
                await logWhatsAppInboundWebhookEvent(db, incoming, {
                    processingError: `Owner not found for WABA=${incoming.businessAccountId || 'missing'} phoneNumberId=${incoming.phoneNumberId || incoming.clinicMetaId || 'missing'}`
                });
                console.warn('Incoming inbox webhook skipped: owner not found.', {
                    clinicMetaId: incoming.clinicMetaId,
                    businessAccountId: incoming.businessAccountId,
                    fromPhone: incoming.fromPhone
                });
                continue;
            }

            const nowIso = new Date().toISOString();
            const windowExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const { data: existingChat } = await selectInboxChatByPhone(db, incoming.fromPhone, userId);
            const existingMetadata = existingChat?.metadata || {};
            const chatDisplayName = existingChat?.name || existingChat?.patient_name || incoming.patientName;
            const chatPhone = existingChat?.phone || incoming.fromPhone;
            const chatPatientPhone = existingChat?.patient_phone || incoming.fromPhone;
            const nextMetadata = {
                ...existingMetadata,
                meta_message_id: incoming.messageId,
                message_id: incoming.messageId,
                conversation_state: 'INBOUND',
                whatsapp_business_account_id: incoming.businessAccountId || existingMetadata.whatsapp_business_account_id || null,
                whatsapp_phone_number_id: incoming.phoneNumberId || existingMetadata.whatsapp_phone_number_id || null,
                display_phone_number: incoming.displayPhoneNumber || existingMetadata.display_phone_number || null,
                subscription_status: 'ACTIVE',
                last_customer_message_at: nowIso,
                last_inbound_at: nowIso,
                whatsapp_window_expires_at: windowExpiresAt,
                window_expires_at: windowExpiresAt,
                input_locked: false
            };

            let chatId = existingChat?.id || null;
            if (!chatId) {
                const createdChat = await writeInboxChatSafely({
                    db,
                    payload: {
                        user_id: userId,
                        doctor_id: userId,
                        name: chatDisplayName,
                        patient_name: chatDisplayName,
                        phone: chatPhone,
                        patient_phone: chatPatientPhone,
                        last_message: incoming.text,
                        status: 'INBOUND',
                        unread_count: 1,
                        updated_at: nowIso,
                        metadata: nextMetadata,
                        whatsapp_window_expires_at: windowExpiresAt,
                        window_expires_at: windowExpiresAt
                    }
                });
                chatId = createdChat?.id || null;
            }

            if (!isUuid(chatId)) {
                await logWhatsAppInboundWebhookEvent(db, incoming, {
                    userId,
                    chatId,
                    processingError: 'No valid inbox_chats parent UUID resolved'
                });
                console.error('Incoming inbox message skipped: no valid inbox_chats parent UUID resolved.', {
                    userId,
                    fromPhone: incoming.fromPhone,
                    chatId
                });
                continue;
            }
            const insertResult = await safeInsertRows({
                table: 'inbox_messages',
                rows: [{
                    chat_id: chatId,
                    workspace_id: userId,
                    sender_phone: incoming.fromPhone,
                    receiver_phone: incoming.clinicMetaId,
                    sender: 'user',
                    from_me: false,
                    type: 'public',
                    message_type: 'text',
                    status: 'INBOUND',
                    message_id: incoming.messageId,
                    meta_message_id: incoming.messageId,
                    wamid: incoming.messageId,
                    body: incoming.text,
                    text: incoming.text,
                    body_content: incoming.text,
                    message_body: incoming.text,
                    message_text: incoming.text,
                    is_private_note: false,
                    metadata: {
                        meta_message_id: incoming.messageId,
                        message_id: incoming.messageId,
                        wamid: incoming.messageId,
                        whatsapp_business_account_id: incoming.businessAccountId || null,
                        whatsapp_phone_number_id: incoming.phoneNumberId || null,
                        display_phone_number: incoming.displayPhoneNumber || null,
                        inbound: true,
                        raw: incoming.raw
                    },
                    created_at: nowIso
                }],
                pruneMissingColumns: true
            });

            await writeInboxChatSafely({
                db,
                chatId,
                payload: {
                    user_id: userId,
                    doctor_id: userId,
                    name: chatDisplayName,
                    patient_name: chatDisplayName,
                    phone: chatPhone,
                    patient_phone: chatPatientPhone,
                    last_message: incoming.text,
                    status: 'INBOUND',
                    unread_count: 1,
                    updated_at: nowIso,
                    metadata: nextMetadata,
                    whatsapp_window_expires_at: windowExpiresAt,
                    window_expires_at: windowExpiresAt
                }
            });

            await logWhatsAppInboundWebhookEvent(db, incoming, {
                userId,
                chatId,
                inserted: insertResult.success,
                processingError: insertResult.success ? null : (insertResult.error || 'Inbox message insert failed')
            });
        } catch (error) {
            await logWhatsAppInboundWebhookEvent(db, incoming, { processingError: error });
            console.error('Incoming inbox webhook sync failed:', error.message || error);
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
    res.status(200).send('EVENT_RECEIVED');

    Promise.resolve()
        .then(async () => {
            if (!verifyMetaWebhookSignature(req)) {
                const payloadShape = getWhatsAppWebhookPayloadShape(req.body);
                const allowTestBypass = process.env.NODE_ENV === 'development' || isMetaDeveloperTestPayload(req.body);
                const allowTemporaryWhatsAppBypass = canTemporarilyBypassMetaSignature(req.body);
                const allowStructuredWhatsAppBypass = hasValidWhatsAppWebhookPayloadStructure(req.body);
                if (allowTestBypass) {
                    console.warn('WhatsApp webhook signature bypassed for Meta developer test payload.', {
                        environment: process.env.NODE_ENV || 'unknown',
                        hasRawBody: typeof req.rawBody === 'string' && req.rawBody.length > 0
                    });
                } else if (allowTemporaryWhatsAppBypass || allowStructuredWhatsAppBypass) {
                    console.warn('WhatsApp webhook signature mismatch allowed for structurally valid WhatsApp payload.', {
                        environment: process.env.NODE_ENV || 'unknown',
                        hasRawBody: typeof req.rawBody === 'string' && req.rawBody.length > 0,
                        hasEntry: Array.isArray(req.body?.entry),
                        hasMessagesField: payloadShape.hasMessagesField,
                        hasStatuses: payloadShape.hasStatuses,
                        hasWamid: payloadShape.hasWamid
                    });
                } else {
                    console.warn('WhatsApp webhook signature mismatch received for non-WhatsApp payload; acknowledged without processing.', {
                        environment: process.env.NODE_ENV || 'unknown',
                        hasRawBody: typeof req.rawBody === 'string' && req.rawBody.length > 0,
                        object: req.body?.object || null,
                        hasEntry: Array.isArray(req.body?.entry)
                    });
                    return;
                }
            }

            const webhookFields = [];
            if (Array.isArray(req.body?.entry)) {
                for (const entry of req.body.entry) {
                    for (const change of entry?.changes || []) {
                        if (change?.field) webhookFields.push(change.field);
                    }
                }
            }
            const statusUpdates = extractMessageStatusUpdates(req.body);
            const statusCount = statusUpdates.length;
            const incomingCount = extractIncomingInboxMessages(req.body).length;
            console.log('WhatsApp webhook POST hit:', {
                object: req.body?.object || null,
                fields: [...new Set(webhookFields)],
                statusCount,
                incomingCount,
                entryCount: Array.isArray(req.body?.entry) ? req.body.entry.length : 0
            });

            if (incomingCount > 0) await processIncomingInboxMessagesWebhook(req.body);
            if (statusUpdates.length > 0) await updateInboxMessageDeliveryStatuses(req.body);
            await processTemplateStatusWebhook(req.body);
            await processFailedDeliveryWebhook(req.body);
            await logRawWhatsAppWebhookHit(req.body, {
                fields: [...new Set(webhookFields)],
                statusCount,
                incomingCount
            });
        })
        .catch((error) => {
            console.error('WhatsApp webhook background processing error:', error.message || error);
        });
};

app.get('/api/webhooks/whatsapp', verifyWhatsAppWebhook);
app.post('/api/webhooks/whatsapp', handleWhatsAppWebhook);
app.get('/api/webhooks/whatsapp/diagnostics', (req, res) => {
    return res.status(200).json({
        success: true,
        service: 'Yogi Desk WhatsApp webhook',
        expectedCallbackUrls: [
            'https://api.yogidesk-ai.com/api/webhooks/whatsapp',
            'https://api.yogidesk-ai.com/api/whatsapp-webhook',
            'https://api.yogidesk-ai.com/api/webhook/meta'
        ],
        verifyTokenConfigured: Boolean(getMetaWebhookVerifyToken()),
        appSecretConfigured: Boolean(getMetaWebhookAppSecret()),
        requiredMetaSubscriptionField: 'messages'
    });
});
app.get('/api/webhooks/whatsapp/audit-ping', async (req, res) => {
    try {
        const token = String(req.query.token || '').trim();
        if (!token || token !== getMetaWebhookVerifyToken()) {
            return res.status(403).json({ success: false, message: 'Invalid audit token.' });
        }

        const db = supabaseAdmin || supabase;
        if (!db?.from) {
            return res.status(500).json({ success: false, message: 'Database connection unavailable.' });
        }

        const { error } = await db.from('whatsapp_webhook_events').insert([{
            source: 'webhook_diagnostics',
            status: 'AUDIT_PING',
            matched_message_count: 0,
            matched_chat_ids: [],
            payload: {
                path: '/api/webhooks/whatsapp/audit-ping',
                at: new Date().toISOString()
            }
        }]);

        if (error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Audit insert failed.',
                details: error.details || null,
                code: error.code || null
            });
        }

        return res.status(200).json({ success: true, message: 'Audit ping inserted.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Audit ping failed.' });
    }
});
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
const fetchMetaMessageTemplates = async ({ businessAccountId, accessToken }) => {
    const templates = [];
    let nextUrl = `https://graph.facebook.com/v20.0/${businessAccountId}/message_templates`;
    let params = { limit: 100 };

    while (nextUrl) {
        const response = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params
        });
        templates.push(...(Array.isArray(response.data?.data) ? response.data.data : []));
        nextUrl = response.data?.paging?.next || '';
        params = undefined;
    }

    return templates;
};

const mapMetaTemplateToWhatsappTemplateRow = ({ metaTemplate, userId }) => {
    const templateName = metaTemplate.name || metaTemplate.template_name || '';
    const rawStatus = String(metaTemplate.status || 'PENDING').toUpperCase();
    const status = rawStatus === 'PENDING_REVIEW' ? 'PENDING' : rawStatus;
    const components = Array.isArray(metaTemplate.components) ? metaTemplate.components : [];
    const body = components.find((component) => component.type === 'BODY');
    const header = components.find((component) => component.type === 'HEADER');
    const footer = components.find((component) => component.type === 'FOOTER');
    const buttons = components.find((component) => component.type === 'BUTTONS');

    return {
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
        meta_template_id: metaTemplate.id || metaTemplate.message_template_id || null
    };
};

const syncCurrentMetaTemplatesForUser = async ({ db, userId, businessAccountId, accessToken }) => {
    const metaTemplates = await fetchMetaMessageTemplates({ businessAccountId, accessToken });
    const rows = metaTemplates
        .map((metaTemplate) => mapMetaTemplateToWhatsappTemplateRow({ metaTemplate, userId }))
        .filter((row) => row.template_name || row.meta_template_id);

    const { error: deleteError } = await db
        .from('whatsapp_templates')
        .delete()
        .eq('user_id', userId);
    if (deleteError) throw deleteError;

    if (rows.length > 0) {
        const { error: insertError } = await db
            .from('whatsapp_templates')
            .insert(rows);
        if (insertError) throw insertError;
    }

    return rows;
};

const syncTemplatesFromMetaInBackground = async (userId) => {
    if (!supabase?.from || !userId) return;

    const { data: userMeta, error: credentialError } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    const businessAccountId = userMeta?.meta_waba_id || userMeta?.whatsapp_business_account_id;
    const accessToken = userMeta?.system_user_token || userMeta?.whatsapp_access_token;

    if (credentialError || !businessAccountId || !accessToken) {
        if (credentialError) console.warn('Background template sync credential error:', credentialError.message);
        return;
    }

    await syncCurrentMetaTemplatesForUser({
        db: supabaseAdmin || supabase,
        userId,
        businessAccountId,
        accessToken
    });
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

        const rows = await syncCurrentMetaTemplatesForUser({
            db,
            userId,
            businessAccountId: metaConfig.whatsapp_business_account_id,
            accessToken: metaConfig.accessToken
        });
        const updates = rows.map((row) => ({
            name: row.template_name,
            id: row.meta_template_id,
            status: row.status,
            language: row.language
        }));

        return res.status(200).json({
            success: true,
            authoritative: true,
            deletedLocalBeforeSync: true,
            templates: updates
        });
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

const STATIC_PREMADE_TEMPLATES = {
    dentist: [
        { id: 'dent_static_1', specialization: 'Dentist', category: 'UTILITY', language: 'English', template_name: 'Dental Routine Check-up Reminder', body_text: 'Hello {{1}}, this is a reminder for your dental routine check-up at {{2}} on {{3}} at {{4}}. Reply CONFIRM to secure your chair time.', has_media: false },
        { id: 'dent_static_2', specialization: 'Dentist', category: 'UTILITY', language: 'English', template_name: 'Root Canal Care Follow-up', body_text: 'Hello {{1}}, Dr. {{2}} recommends a root canal care follow-up after your recent procedure. Please book your review here: {{3}}', has_media: false },
        { id: 'dent_static_3', specialization: 'Dentist', category: 'UTILITY', language: 'English', template_name: 'Braces Adjustment Appointment Notice', body_text: 'Hello {{1}}, your braces adjustment appointment is scheduled at {{2}} on {{3}}. Please arrive 10 minutes early for check-in.', has_media: false },
        { id: 'dent_static_4', specialization: 'Dentist', category: 'UTILITY', language: 'English', template_name: 'Dental Cleaning Recall', body_text: 'Hello {{1}}, it is time for your dental cleaning recall at {{2}}. Reserve a convenient slot here: {{3}}', has_media: false },
        { id: 'dent_static_5', specialization: 'Dentist', category: 'MARKETING', language: 'English', template_name: 'Smile Makeover Camp Invite', body_text: 'Dear {{1}}, {{2}} is hosting a smile makeover consultation camp this week. Reply BOOK to reserve your dental consultation slot.', has_media: false }
    ],
    general_physician: [
        { id: 'gp_static_1', specialization: 'General Physician', category: 'UTILITY', language: 'English', template_name: 'Chronic Care Follow-up', body_text: 'Hello {{1}}, this is a follow-up reminder from Dr. {{2}} for your chronic care review. Book your next consultation here: {{3}}', has_media: false },
        { id: 'gp_static_2', specialization: 'General Physician', category: 'UTILITY', language: 'English', template_name: 'Consultation Review Reminder', body_text: 'Hello {{1}}, your consultation review is due on {{2}} at {{3}}. Please bring your previous prescription and reports.', has_media: false },
        { id: 'gp_static_3', specialization: 'General Physician', category: 'UTILITY', language: 'English', template_name: 'Medication Adherence Check', body_text: 'Hello {{1}}, Dr. {{2}} is checking in on your medication schedule. Reply DONE if doses are on track or HELP for support.', has_media: false },
        { id: 'gp_static_4', specialization: 'General Physician', category: 'UTILITY', language: 'English', template_name: 'Lab Report Consultation', body_text: 'Hello {{1}}, your reports are ready for review. Please schedule a consultation with Dr. {{2}} using this link: {{3}}', has_media: false },
        { id: 'gp_static_5', specialization: 'General Physician', category: 'MARKETING', language: 'English', template_name: 'Preventive Health Check-up Invite', body_text: 'Dear {{1}}, {{2}} is running a preventive health check-up drive. Reply BOOK to reserve your consultation.', has_media: false }
    ]
};

const getStaticPremadeTemplates = (specializationQuery, language) => {
    const templates = STATIC_PREMADE_TEMPLATES[specializationQuery] || STATIC_PREMADE_TEMPLATES.general_physician;
    const normalizedLanguage = String(language || '').trim().toLowerCase();
    if (!normalizedLanguage || normalizedLanguage === 'all') return templates;
    const filtered = templates.filter((template) => String(template.language || '').toLowerCase().includes(normalizedLanguage));
    return filtered.length ? filtered : templates;
};

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
        return getStaticPremadeTemplates(specializationQuery, language);
    }

    if (!Array.isArray(data) || data.length === 0) {
        const fallbackResult = await runQuery(specializationQuery);
        if (fallbackResult.error) {
            console.warn('Pre-made template fallback lookup failed:', fallbackResult.error.message || fallbackResult.error);
            return getStaticPremadeTemplates(specializationQuery, language);
        }
        data = fallbackResult.data;
    }

    if (!Array.isArray(data) || data.length === 0) {
        data = getStaticPremadeTemplates(specializationQuery, language);
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
        { table: 'doctor_profiles', select: 'id,name,clinic_name,business_name,specialization,clinic_category,business_category,clinic_booking_link,booking_link,website' },
        { table: 'doctor_profiles', select: 'id,name,clinic_name,business_name,specialization,clinic_category,business_category,industry,booking_link' },
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
            const rawSpecialization = data.clinic_category || data.specialization || data.business_category || data.industry || '';
            const specialization = normalizeSpecialization(rawSpecialization);
            return {
                ...data,
                specialization,
                clinicName: data.clinic_name || data.business_name || data.name || '',
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
            select: '*'
        },
        {
            table: 'users',
            select: '*'
        },
        {
            table: 'clinics',
            select: '*'
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
        { table: 'doctor_profiles', select: '*' },
        { table: 'users', select: '*' },
        { table: 'clinics', select: '*' }
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
            select: '*',
            map: (row) => ({
                accessToken: row?.system_user_token || row?.whatsapp_access_token || '',
                businessAccountId: row?.meta_waba_id || row?.whatsapp_business_account_id || '',
                phoneNumberId: row?.meta_phone_number_id || row?.whatsapp_phone_number_id || ''
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

const uploadInboxMedia = async ({ db, userId, file }) => {
    if (!file?.buffer?.length) throw new Error('Attach an image or PDF file.');
    if (!db?.storage?.from) throw new Error('Supabase storage client unavailable.');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.mimeType)) {
        throw new Error('Only images and PDF files can be attached to a WhatsApp reply.');
    }

    const extensionByType = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'application/pdf': 'pdf'
    };
    const extension = extensionByType[file.mimeType] || 'bin';
    const safeFilename = String(file.filename || `attachment.${extension}`).replace(/[^\w.\-]+/g, '_').slice(0, 120);
    const bucket = process.env.SUPABASE_INBOX_MEDIA_BUCKET || process.env.SUPABASE_TEMPLATE_MEDIA_BUCKET || 'template-media';
    const storagePath = `${userId}/inbox/${Date.now()}-${crypto.randomUUID()}-${safeFilename}`;
    const { error: uploadError } = await db.storage
        .from(bucket)
        .upload(storagePath, file.buffer, {
            contentType: file.mimeType,
            upsert: false
        });

    if (uploadError) throw uploadError;

    const { data } = db.storage.from(bucket).getPublicUrl(storagePath);
    return {
        url: data?.publicUrl || '',
        mimeType: file.mimeType,
        filename: safeFilename,
        mediaType: file.mimeType === 'application/pdf' ? 'document' : 'image'
    };
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
                clinic_name: profile.clinicName || profile.clinic_name || profile.business_name || '',
                specialization,
                clinic_category: specialization,
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

app.post('/api/profile/onboarding', async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        if (!db?.from) return res.status(500).json({ success: false, message: 'Database connection unavailable.' });

        const sessionUser = await getSupabaseSessionUser(req);
        const userId = req.body?.userId || sessionUser?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated doctor session is required.' });
        if (!sessionUser?.id || sessionUser.id !== userId) return res.status(403).json({ success: false, message: 'Forbidden' });

        const clinicName = sanitizePlainText(req.body?.clinic_name || req.body?.clinicName, 120);
        const specialization = normalizeSpecialization(req.body?.specialization);
        const phoneNumberId = sanitizePlainText(req.body?.whatsapp_phone_number_id || req.body?.phoneNumberId, 80);

        if (!clinicName) return res.status(400).json({ success: false, message: 'Clinic name is required.' });
        if (!specialization) return res.status(400).json({ success: false, message: 'Specialization is required.' });
        if (!phoneNumberId) return res.status(400).json({ success: false, message: 'Meta WhatsApp Phone Number ID is required.' });

        const payload = {
            id: userId,
            email: sessionUser.email || null,
            name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || clinicName,
            clinic_name: clinicName,
            business_name: clinicName,
            specialization,
            business_category: specialization,
            whatsapp_phone_number_id: phoneNumberId,
            meta_phone_number_id: phoneNumberId,
            updated_at: new Date().toISOString()
        };

        const savedProfile = await upsertSingleRowSafely({
            db,
            table: 'doctor_profiles',
            row: payload
        });

        return res.status(200).json({
            success: true,
            profile: savedProfile || payload
        });
    } catch (error) {
        console.error('Profile onboarding save error:', error.message || error);
        return res.status(500).json({ success: false, message: error.message || 'Unable to save onboarding profile.' });
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

        const { data: userMeta, error: credentialError } = await db
            .from('doctor_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (credentialError) throw credentialError;
        const businessAccountId = userMeta?.meta_waba_id || userMeta?.whatsapp_business_account_id;
        const accessToken = userMeta?.system_user_token || userMeta?.whatsapp_access_token;
        if (!businessAccountId || !accessToken) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp Business Account credentials.' });
        }

        let metaResponse;
        try {
            metaResponse = await axios.delete(`https://graph.facebook.com/v20.0/${businessAccountId}/message_templates`, {
                params: { name: template.template_name },
                headers: { Authorization: `Bearer ${accessToken}` }
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

        const scheduleUnitCost = getUnitCost(template.category);
        const scheduleTotalCost = Number((uniqueRecipients.length * scheduleUnitCost).toFixed(2));
        if (Number(wallet.balance || 0) < scheduleTotalCost) {
            return res.status(400).json({ success: false, msg: "Insufficient wallet balance. Please recharge." });
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
            return res.status(500).json({ success: false, msg: "Campaign queue unavailable. Please try again after schema refresh." });
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

const safeInsertRows = async ({ table, rows, pruneMissingColumns = true }) => {
    if (!supabase?.from || !Array.isArray(rows) || rows.length === 0) return { success: false };
    let payload = rows.map((row) => removeUndefinedValues(row || {}));
    const removedColumns = new Set();

    while (payload.length && Object.keys(payload[0] || {}).length) {
        const { data, error } = await supabase.from(table).insert(payload).select();
        if (!error) return { success: true, data };

        const missingColumn = getMissingSchemaColumn(error);
        if (pruneMissingColumns && missingColumn && !removedColumns.has(missingColumn)) {
            console.warn(`Skipping missing ${table}.${missingColumn} column during insert.`, {
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            removedColumns.add(missingColumn);
            payload = payload.map((row) => {
                const { [missingColumn]: _removed, ...nextRow } = row;
                return nextRow;
            });
            continue;
        }

        console.error(`${table} insert failed:`, {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        return { success: false, error };
    }

    return { success: false };
};

const resolveInboxRequestUserId = async (req) => {
    const sessionUser = await getSupabaseSessionUser(req);
    const requestedUserId = String(req.query.userId || req.body?.userId || '').trim();

    if (sessionUser?.id && requestedUserId && requestedUserId !== sessionUser.id) {
        const error = new Error('Forbidden');
        error.statusCode = 403;
        throw error;
    }

    return sessionUser?.id || requestedUserId || '';
};

app.get('/api/inbox/chats', async (req, res) => {
    try {
        if (!supabase?.from) return res.status(500).json({ success: false, message: 'Database connection unavailable' });
        const userId = await resolveInboxRequestUserId(req);
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated user is required.' });

        const db = supabaseAdmin || supabase;
        const { data: teamMembers, error: teamError } = await db
            .from('team_members')
            .select('id, name, email, status')
            .eq('admin_id', userId)
            .in('status', ['ACTIVE', 'INVITED']);

        if (teamError && teamError.code !== 'PGRST205') {
            console.error('Inbox team member load failed:', teamError.message || teamError);
        }

        let chatResult = await db
            .from('inbox_chats')
            .select('id, user_id, doctor_id, name, last_message, updated_at, phone, patient_phone, status, unread_count, patient_name, scheduled_at, assigned_agent_id, window_expires_at, whatsapp_window_expires_at, metadata')
            .or(`user_id.eq.${userId},doctor_id.eq.${userId}`)
            .order('updated_at', { ascending: false });

        if (chatResult.error && getMissingSchemaColumn(chatResult.error)) {
            chatResult = await db
                .from('inbox_chats')
                .select('id, user_id, doctor_id, name, last_message, updated_at, phone, patient_phone, status, unread_count, patient_name, scheduled_at')
                .or(`user_id.eq.${userId},doctor_id.eq.${userId}`)
                .order('updated_at', { ascending: false });
        }

        if (chatResult.error) throw chatResult.error;

        let chats = chatResult.data || [];
        if (chats.length === 0) {
            const { data: messageRows, error: messageError } = await db
                .from('inbox_messages')
                .select('chat_id, message_text, message_body, body, text, sender, from_me, type, message_type, receiver_phone, sender_phone, workspace_id, sender_id, status, created_at')
                .or(`workspace_id.eq.${userId},sender_id.eq.${userId}`)
                .order('created_at', { ascending: false })
                .limit(50);

            if (messageError && !getMissingSchemaColumn(messageError)) throw messageError;

            const fallbackChats = new Map();
            for (const item of messageRows || []) {
                const phone = item.receiver_phone || item.sender_phone || '';
                const key = item.chat_id || phone || item.created_at;
                if (fallbackChats.has(key)) continue;
                fallbackChats.set(key, {
                    id: item.chat_id || `message-${key}`,
                    name: phone || 'Patient',
                    patient_name: phone || 'Patient',
                    phone,
                    last_message: item.message_text || item.message_body || item.body_content || item.body || item.text || '',
                    updated_at: item.created_at,
                    status: item.status || 'SENT',
                    unread_count: 0,
                    metadata: { messages: [item], source_chat_id: item.chat_id || null },
                });
            }
            chats = Array.from(fallbackChats.values());
        }

        const collapsedChats = new Map();
        for (const chat of chats) {
            const phoneKey = getPhoneMatchParts(chat.phone || chat.patient_phone || '').last10;
            const key = phoneKey || String(chat.phone || chat.patient_phone || chat.id || '').trim();
            const previous = collapsedChats.get(key);
            const previousTime = previous?.updated_at ? new Date(previous.updated_at).getTime() : 0;
            const nextTime = chat?.updated_at ? new Date(chat.updated_at).getTime() : 0;
            const previousMeta = previous?.metadata || {};
            const nextMeta = chat?.metadata || {};
            const previousEstablished = previousMeta.last_template || previousMeta.template_id || previousMeta.template_name ? 1 : 0;
            const nextEstablished = nextMeta.last_template || nextMeta.template_id || nextMeta.template_name ? 1 : 0;
            if (!previous || nextEstablished > previousEstablished || (nextEstablished === previousEstablished && nextTime >= previousTime)) {
                collapsedChats.set(key, chat);
            }
        }
        chats = Array.from(collapsedChats.values()).sort((a, b) => {
            const aTime = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
            const bTime = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
            return bTime - aTime;
        });

        return res.status(200).json({
            success: true,
            chats,
            teamMembers: teamMembers || []
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        console.error('Inbox chat API failed:', error.message || error);
        return res.status(statusCode).json({ success: false, message: error.message || 'Unable to load inbox.' });
    }
});

app.get('/api/inbox/messages', async (req, res) => {
    try {
        if (!supabase?.from) return res.status(500).json({ success: false, message: 'Database connection unavailable' });
        const userId = await resolveInboxRequestUserId(req);
        const chatId = String(req.query.chatId || '').trim();
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated user is required.' });
        if (!chatId || chatId.startsWith('message-')) return res.status(200).json({ success: true, messages: [] });

        const db = supabaseAdmin || supabase;
        const { data: chat, error: chatError } = await db
            .from('inbox_chats')
            .select('id, user_id, doctor_id, name, patient_name, phone, patient_phone, status, unread_count, updated_at, window_expires_at, whatsapp_window_expires_at, metadata')
            .eq('id', chatId)
            .or(`user_id.eq.${userId},doctor_id.eq.${userId}`)
            .maybeSingle();

        if (chatError) throw chatError;
        if (!chat?.id) return res.status(404).json({ success: false, message: 'Chat not found.' });

        await db
            .from('inbox_chats')
            .update({ unread_count: 0 })
            .eq('id', chatId);

        let result = await db
            .from('inbox_messages')
            .select('id, chat_id, wamid, meta_message_id, message_id, body_content, body, text, message_body, message_text, sender, from_me, type, message_type, is_private_note, status, created_at, metadata')
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });

        if (result.error && getMissingSchemaColumn(result.error)) {
            result = await db
                .from('inbox_messages')
                .select('id, chat_id, body, text, message_body, sender, from_me, type, is_private_note, status, created_at')
                .eq('chat_id', chatId)
                .order('created_at', { ascending: true });
        }

        if (result.error) throw result.error;
        const { data: refreshedChat } = await db
            .from('inbox_chats')
            .select('id, user_id, doctor_id, name, patient_name, phone, patient_phone, status, unread_count, updated_at, window_expires_at, whatsapp_window_expires_at, metadata')
            .eq('id', chatId)
            .maybeSingle();

        return res.status(200).json({ success: true, messages: result.data || [], chat: refreshedChat || { ...chat, unread_count: 0 } });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        console.error('Inbox messages API failed:', error.message || error);
        return res.status(statusCode).json({ success: false, message: error.message || 'Unable to load messages.' });
    }
});

app.post('/api/inbox/upload-media', async (req, res) => {
    try {
        const db = supabaseAdmin || supabase;
        if (!db?.from) return res.status(500).json({ success: false, message: 'Database connection unavailable' });

        const multipartPayload = await parseMultipartForm(req, { maxBytes: 16 * 1024 * 1024 });
        const requestBody = multipartPayload.fields || {};
        const mediaFile = multipartPayload.files?.media || multipartPayload.files?.file || null;
        const sessionUser = await getSupabaseSessionUser(req);
        const userId = requestBody.userId || sessionUser?.id;
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated user is required.' });

        const uploaded = await uploadInboxMedia({ db, userId, file: mediaFile });
        if (!uploaded.url) throw new Error('Unable to generate a public media URL.');

        return res.status(200).json({ success: true, media: uploaded });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        console.error('Inbox media upload failed:', error.message || error);
        return res.status(statusCode).json({ success: false, message: error.message || 'Unable to upload media.' });
    }
});

app.post('/api/inbox/send-message', async (req, res) => {
    try {
        if (!supabase?.from) return res.status(500).json({ success: false, message: 'Database connection unavailable' });

        const userId = await resolveInboxRequestUserId(req);
        const chatId = String(req.body?.chatId || req.body?.activeChatId || '').trim();
        const messageText = String(req.body?.messageText || req.body?.text || req.body?.body || '').trim();
        const mediaUrl = String(req.body?.mediaUrl || req.body?.fileUrl || '').trim();
        const mediaType = String(req.body?.mediaType || '').trim().toLowerCase();
        const mediaMimeType = String(req.body?.mimeType || '').trim();
        const mediaFilename = String(req.body?.filename || req.body?.originalName || 'attachment').trim();
        if (!userId) return res.status(401).json({ success: false, message: 'Authenticated user is required.' });
        if (!isUuid(chatId)) return res.status(400).json({ success: false, message: 'Valid chatId is required.' });
        if (!messageText && !mediaUrl) return res.status(400).json({ success: false, message: 'Message text or media is required.' });

        const db = supabaseAdmin || supabase;
        let { data: activeChat, error: chatError } = await db
            .from('inbox_chats')
            .select('id, user_id, doctor_id, phone, patient_phone, name, patient_name, metadata')
            .eq('id', chatId)
            .or(`user_id.eq.${userId},doctor_id.eq.${userId}`)
            .maybeSingle();

        if (chatError) throw chatError;
        if (!activeChat?.id) return res.status(404).json({ success: false, message: 'Chat not found.' });

        const recipientPhone = sanitizeMetaPhoneNumber(activeChat.patient_phone || activeChat.phone || '');
        if (!recipientPhone) return res.status(400).json({ success: false, message: 'Patient phone number is missing.' });
        const { data: canonicalChat } = await selectInboxChatByPhone(db, recipientPhone, userId);
        if (canonicalChat?.id) {
            activeChat = {
                ...activeChat,
                ...canonicalChat,
                metadata: canonicalChat.metadata || activeChat.metadata || {}
            };
        }

        const credentials = await getUserMetaCredentials(userId);
        const finalToken = String(credentials.accessToken || '').trim();
        const finalPhoneId = String(credentials.phoneNumberId || '').trim();
        if (!finalPhoneId || !finalToken) {
            return res.status(400).json({ success: false, message: 'Missing WhatsApp phone number ID or access token for this doctor.' });
        }

        const normalizedMediaType = mediaUrl
            ? (mediaType === 'document' || mediaMimeType === 'application/pdf' || /\.pdf($|\?)/i.test(mediaUrl) ? 'document' : 'image')
            : 'text';
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhone.trim(),
            type: normalizedMediaType
        };
        if (normalizedMediaType === 'image') {
            payload.image = removeUndefinedValues({
                link: mediaUrl,
                caption: messageText || undefined
            });
        } else if (normalizedMediaType === 'document') {
            payload.document = removeUndefinedValues({
                link: mediaUrl,
                filename: mediaFilename || 'attachment.pdf',
                caption: messageText || undefined
            });
        } else {
            payload.text = { body: messageText };
        }

        let metaResponse;
        try {
            metaResponse = await axios.post(`https://graph.facebook.com/v20.0/${finalPhoneId}/messages`, payload, {
                headers: {
                    Authorization: `Bearer ${finalToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            });
        } catch (error) {
            const providerMessage = error.response?.data?.error?.message || error.message || 'Meta free-form send failed.';
            console.error('Meta free-form inbox send failed:', error.response?.data || providerMessage);
            return res.status(error.response?.status || 400).json({
                success: false,
                message: providerMessage,
                provider: error.response?.data || null
            });
        }

        const wamid = metaResponse.data?.messages?.[0]?.id || null;
        const nowIso = new Date().toISOString();
        const messagePreview = messageText || mediaFilename || (normalizedMediaType === 'image' ? 'Image attachment' : normalizedMediaType === 'document' ? 'Document attachment' : mediaUrl);
        const storedBodyContent = mediaUrl || messageText;
        const messageRow = {
            chat_id: activeChat.id,
            workspace_id: userId,
            sender_id: userId,
            sender: 'agent',
            from_me: true,
            type: 'public',
            message_type: normalizedMediaType,
            status: 'SENT',
            body_content: storedBodyContent,
            body: storedBodyContent,
            text: messageText || storedBodyContent,
            message_body: messageText || storedBodyContent,
            message_text: messageText || storedBodyContent,
            sender_phone: finalPhoneId,
            receiver_phone: recipientPhone,
            is_private_note: false,
            wamid,
            message_id: wamid,
            meta_message_id: wamid,
            metadata: {
                wamid,
                message_id: wamid,
                meta_message_id: wamid,
                whatsapp_phone_number_id: finalPhoneId,
                whatsapp_business_account_id: credentials.businessAccountId || null,
                meta_response: metaResponse.data,
                free_form_reply: true,
                media_url: mediaUrl || null,
                media_type: normalizedMediaType,
                mime_type: mediaMimeType || null,
                filename: mediaFilename || null,
                caption: messageText || null
            },
            created_at: nowIso
        };

        const insertResult = await safeInsertRows({
            table: 'inbox_messages',
            rows: [messageRow],
            pruneMissingColumns: true
        });

        if (!insertResult.success) {
            return res.status(500).json({ success: false, message: 'Message sent to Meta, but inbox logging failed.' });
        }

        await writeInboxChatSafely({
            db,
            chatId: activeChat.id,
            payload: {
                last_message: messagePreview,
                status: 'SENT',
                unread_count: 0,
                updated_at: nowIso,
                metadata: {
                    ...(activeChat.metadata || {}),
                    last_free_form_reply: {
                        wamid,
                        message_id: wamid,
                        sent_at: nowIso,
                        body_preview: messageText || mediaFilename || mediaUrl,
                        media_url: mediaUrl || null,
                        media_type: normalizedMediaType
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Message sent.',
            chatId: activeChat.id,
            wamid,
            meta: metaResponse.data,
            storedMessage: insertResult.data?.[0] || messageRow
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        console.error('Inbox free-form send API failed:', error.message || error);
        return res.status(statusCode).json({ success: false, message: error.message || 'Unable to send message.' });
    }
});

app.post('/api/campaigns/send', async (req, res) => {
    try {
        if (!supabase) return res.status(500).json({ success: false, message: "Database connection unavailable" });

        const { userId, template, recipients = [] } = req.body;
        if (!userId || !template || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({ success: false, message: "Template and recipients are required" });
        }

        const seen = new Set();
        const uniqueRecipients = recipients
            .map((recipient) => ({
                name: String(recipient.name || recipient.patientName || '').trim(),
                phone: normalizePhone(recipient.phone || recipient.patientPhone || ''),
                appointment_time: String(recipient.appointment_time || recipient.appointmentTime || '').trim()
            }))
            .filter((recipient) => {
                if (!recipient.name || !recipient.phone || seen.has(recipient.phone)) return false;
                seen.add(recipient.phone);
                return true;
            });

        if (!uniqueRecipients.length) {
            return res.status(400).json({ success: false, message: "No valid recipients found." });
        }

        const unitCost = getUnitCost(template.category);
        const totalCost = Number((uniqueRecipients.length * unitCost).toFixed(2));

        const { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('balance, plan_tier, lifetime_contacts_count')
            .eq('user_id', userId)
            .maybeSingle();

        if (walletError) throw walletError;
        if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found. Please recharge." });

        const currentBalance = Number(wallet.balance || 0);
        if (currentBalance < totalCost) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance. Please recharge." });
        }

        const nextBalance = Number((currentBalance - totalCost).toFixed(2));
        const nextContactsCount = Number(wallet.lifetime_contacts_count || 0) + uniqueRecipients.length;
        const campaignId = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        const { error: debitError } = await supabase
            .from('wallets')
            .update({
                balance: nextBalance,
                lifetime_contacts_count: nextContactsCount
            })
            .eq('user_id', userId);

        if (debitError) throw debitError;

        let sentCount = 0;
        let failedCount = 0;
        const failures = [];

        for (const recipient of uniqueRecipients) {
            const row = buildCampaignQueuePayload({
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
                scheduledFor: nowIso
            });
            row.status = 'SENDING';

            try {
                const metaResult = await sendCampaignMessageToMeta(row);
                sentCount += 1;
                await upsertCampaignInboxMessage({ row, metaResult });
            } catch (sendError) {
                failedCount += 1;
                const failedMessageId = sendError.response?.data?.error?.fbtrace_id ||
                    sendError.response?.data?.error?.message_id ||
                    `immediate_failed_${campaignId}_${recipient.phone}`;
                failures.push({
                    phone: recipient.phone,
                    message_id: failedMessageId,
                    message: sendError.clientPayload?.msg || sendError.message || 'Meta send failed'
                });
                await upsertCampaignInboxMessage({
                    row,
                    metaResult: null,
                    deliveryStatus: 'FAILED',
                    deliveryError: sendError.clientPayload?.msg || sendError.message || 'Meta send failed'
                });
                await processFailedDeliveryRefund({
                    userId,
                    messageId: failedMessageId,
                    templateCategory: template.category || 'MARKETING',
                    templateName: template.template_name || template.name || 'WhatsApp Template',
                    templateId: template.id || null,
                    reason: sendError.clientPayload?.msg || sendError.message || 'Meta send failed',
                    source: 'immediate_campaign_dispatch',
                    rawStatus: 'failed'
                });
                console.error('Immediate campaign send failed:', sendError.message || sendError);
            }
        }

        const templateName = template.template_name || template.name || 'WhatsApp Template';
        const templateCategory = template.category || 'MARKETING';

        const transactionPayload = {
            user_id: userId,
            amount: totalCost,
            transaction_type: 'DEBIT',
            description: `Campaign ${templateName} sent to patients`,
            metadata: {
                campaign_id: campaignId,
                template_id: template.id || null,
                template_name: templateName,
                category: templateCategory,
                unit_cost: unitCost,
                recipients: uniqueRecipients.length,
                sent: sentCount,
                failed: failedCount
            },
            created_at: nowIso
        };

        await safeInsertRows({
            table: 'wallet_transactions',
            rows: [transactionPayload],
            pruneMissingColumns: false
        });

        const analyticsPayload = {
            user_id: userId,
            campaign_id: campaignId || `camp_${Date.now()}`,
            template_name: templateName,
            template_id: template.id || null,
            category: templateCategory,
            total_recipients: uniqueRecipients.length,
            sent_count: sentCount,
            failed_count: failedCount,
            total_cost: totalCost,
            wallet_balance_before: currentBalance,
            wallet_balance_after: nextBalance,
            status: failedCount === uniqueRecipients.length ? 'FAILED' : 'COMPLETED',
            metadata: {
                timestamp: nowIso,
                failures
            },
            created_at: nowIso
        };

        await safeInsertRows({
            table: 'campaign_analytics',
            rows: [analyticsPayload],
            pruneMissingColumns: false
        });

        return res.status(200).json({
            success: true,
            message: "Campaign executed successfully.",
            campaignId,
            sent: sentCount,
            failed: failedCount,
            deducted: totalCost,
            remaining_balance: nextBalance,
            failures
        });
    } catch (error) {
        console.error('Campaign send error:', error.message || error);
        return res.status(500).json({ success: false, message: "Campaign execution failed. Please try again." });
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
                transaction_type: 'DEBIT',
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
                transaction_type: 'CREDIT',
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
        const { data, error } = await supabase
            .from('doctor_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error || !data) return {};
        const finalToken = data.system_user_token || data.whatsapp_access_token || null;
        const finalPhoneId = data.meta_phone_number_id || data.whatsapp_phone_number_id || null;
        const finalBusinessAccountId = data.meta_waba_id || data.whatsapp_business_account_id || null;
        console.log("Resolved Meta Parameters Status:", { hasToken: !!finalToken, hasPhoneId: !!finalPhoneId });

        return {
            phoneNumberId: finalPhoneId,
            businessAccountId: finalBusinessAccountId,
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
    const finalToken = credentials.accessToken || null;
    const finalPhoneId = credentials.phoneNumberId || null;

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
    const text = row.message_body || row.body_text || row.text || row.messageBody || row.payload?.text || row.payload?.body_text || row.payload?.messageBody || row.payload?.template?.templateText || row.payload?.template?.bodyText || row.payload?.template?.body_text || row.payload?.template?.messageBody || row.payload?.template?.body_content;
    return String(text || `Sent template: ${row.template_name || 'WhatsApp Template'}`).trim();
};

const selectInboxChatByPhone = async (db, recipientPhone, userId) => {
    const safePhone = String(recipientPhone || '').trim();
    if (!safePhone) return { data: null, error: null };

    let ownerQuery = db
        .from('inbox_chats')
        .select('id, phone, patient_phone, name, patient_name, metadata, updated_at')
        .order('updated_at', { ascending: false })
        .limit(500);

    if (userId) {
        ownerQuery = ownerQuery.or(`user_id.eq.${userId},doctor_id.eq.${userId}`);
    }

    let result = await ownerQuery;
    if (result.error && getMissingSchemaColumn(result.error) === 'metadata') {
        let fallbackQuery = db
            .from('inbox_chats')
            .select('id, phone, patient_phone, updated_at')
            .order('updated_at', { ascending: false })
            .limit(500);

        if (userId) {
            fallbackQuery = fallbackQuery.or(`user_id.eq.${userId},doctor_id.eq.${userId}`);
        }

        result = await fallbackQuery;
    }

    if (result.error) return result;

    const matchingChats = (result.data || []).filter((chat) => (
        phonesReferToSameContact(chat.phone, safePhone) ||
        phonesReferToSameContact(chat.patient_phone, safePhone)
    ));
    matchingChats.sort((left, right) => {
        const leftMeta = left.metadata || {};
        const rightMeta = right.metadata || {};
        const leftEstablished = leftMeta.last_template || leftMeta.template_id || leftMeta.template_name ? 1 : 0;
        const rightEstablished = rightMeta.last_template || rightMeta.template_id || rightMeta.template_name ? 1 : 0;
        if (leftEstablished !== rightEstablished) return rightEstablished - leftEstablished;
        const leftTime = left.updated_at ? new Date(left.updated_at).getTime() : 0;
        const rightTime = right.updated_at ? new Date(right.updated_at).getTime() : 0;
        return rightTime - leftTime;
    });

    return { data: matchingChats[0] || null, error: null };
};

const resolveCampaignConversationChatId = async ({ db, userId, recipientPhone, recipientName, messageBody, nowIso }) => {
    const safePhone = String(recipientPhone || '').trim();
    if (!db?.from || !userId || !safePhone) return null;

    const isMissingChatsTable = (error) => {
        const message = String(error?.message || error?.details || '').toLowerCase();
        return error?.code === 'PGRST205' || message.includes("could not find the table") || message.includes("could not find table") || message.includes("schema cache");
    };

    try {
        const { data: existingChat, error: chatFindError } = await db
            .from('chats')
            .select('id')
            .eq('receiver_phone', safePhone)
            .eq('user_id', userId)
            .maybeSingle();

        if (chatFindError) {
            if (isMissingChatsTable(chatFindError)) return null;
            console.error('Campaign chats lookup failed:', chatFindError.message || chatFindError);
            return null;
        }

        if (existingChat?.id) return existingChat.id;

        const { data: newChat, error: chatCreateError } = await db
            .from('chats')
            .insert({
                user_id: userId,
                receiver_phone: safePhone,
                receiver_name: recipientName || 'Patient',
                last_message: messageBody || 'Template Campaign Sent',
                updated_at: nowIso
            })
            .select('id')
            .maybeSingle();

        if (chatCreateError) {
            if (!isMissingChatsTable(chatCreateError)) {
                console.error('Campaign chats create failed:', chatCreateError.message || chatCreateError);
            }
            return null;
        }

        return newChat?.id || null;
    } catch (error) {
        console.error('Campaign chats resolver failed:', error.message || error);
        return null;
    }
};

const writeInboxChatSafely = async ({ db, payload, chatId }) => {
    let nextPayload = removeUndefinedValues(payload);
    const removedColumns = new Set();

    while (Object.keys(nextPayload).length) {
        const query = chatId
            ? db.from('inbox_chats').update(nextPayload).eq('id', chatId).select('id').maybeSingle()
            : db.from('inbox_chats').insert([nextPayload]).select('id').maybeSingle();
        const { data, error } = await query;
        if (!error) return data;

        const missingColumn = getMissingSchemaColumn(error);
        if (missingColumn && !removedColumns.has(missingColumn)) {
            console.warn(`Skipping missing inbox_chats.${missingColumn} column during campaign inbox write.`, {
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            removedColumns.add(missingColumn);
            const { [missingColumn]: _removed, ...strippedPayload } = nextPayload;
            nextPayload = strippedPayload;
            continue;
        }

        console.error('Campaign inbox chat write failed:', error.message || error);
        return null;
    }

    return null;
};

const upsertCampaignInboxMessage = async ({ row = {}, metaResult = null, fallbackDispatch = false, deliveryStatus = 'SENT', deliveryError = null }) => {
    if (!supabase?.from) return;
    const db = supabaseAdmin || supabase;

    const nowIso = new Date().toISOString();
    const recipientPhone = String(
        row.recipient_phone ||
        row.phone ||
        row.payload?.recipient?.phone_number ||
        row.payload?.recipient?.patientPhone ||
        row.payload?.recipient?.phone ||
        ''
    ).trim();
    const safeReceiverPhone = recipientPhone || 'UNKNOWN';
    const safeSenderPhone = String(
        row.sender_phone ||
        row.phone_number_id ||
        row.whatsapp_phone_number_id ||
        row.meta_phone_number_id ||
        row.payload?.sender_phone ||
        row.payload?.template?.sender_phone ||
        row.payload?.template?.whatsapp_phone_number_id ||
        row.payload?.template?.meta_phone_number_id ||
        metaResult?.phone_number_id ||
        metaResult?.response?.metadata?.phone_number_id ||
        'SYSTEM'
    ).trim() || 'SYSTEM';
    const recipientName = String(row.recipient_name || row.payload?.recipient?.patientName || row.payload?.recipient?.name || 'Patient').trim();
    const userId = row.user_id || row.doctor_id || null;
    const messageBody = resolveCampaignMessagePreview(row);
    const whatsappBusinessAccountId = sanitizeMetaId(
        metaResult?.whatsapp_business_account_id ||
        metaResult?.business_account_id ||
        metaResult?.response?.metadata?.whatsapp_business_account_id ||
        row.whatsapp_business_account_id ||
        row.meta_waba_id ||
        row.payload?.template?.whatsapp_business_account_id ||
        row.payload?.template?.meta_waba_id ||
        ''
    ) || null;
    const metadata = {
        template_id: row.template_id || row.payload?.template?.id || null,
        template_name: row.template_name || row.payload?.template?.template_name || row.payload?.template?.name || 'WhatsApp Template',
        template_category: row.template_category || row.payload?.template?.category || 'UTILITY',
        wamid: getMetaMessageId(metaResult),
        message_id: getMetaMessageId(metaResult),
        meta_message_id: getMetaMessageId(metaResult),
        whatsapp_business_account_id: whatsappBusinessAccountId,
        whatsapp_phone_number_id: safeSenderPhone === 'SYSTEM' ? null : safeSenderPhone,
        sender_phone: safeSenderPhone,
        receiver_phone: safeReceiverPhone,
        meta_result: metaResult,
        delivery_status: deliveryStatus,
        delivery_error: deliveryError,
        sent_at: nowIso,
        fallback_dispatch: fallbackDispatch,
    };
    const conversationChatId = await resolveCampaignConversationChatId({
        db,
        userId,
        recipientPhone: safeReceiverPhone,
        recipientName,
        messageBody,
        nowIso
    });

    const storedMessagePreview = {
        id: getMetaMessageId(metaResult) || `${nowIso}-${safeReceiverPhone}`,
        chat_id: null,
        message_text: messageBody,
        message_body: messageBody,
        body: messageBody,
        text: messageBody,
        sender: 'agent',
        from_me: true,
        type: 'template',
        message_type: 'text',
        sender_phone: safeSenderPhone,
        receiver_phone: safeReceiverPhone,
        workspace_id: userId,
        sender_id: userId,
        created_at: nowIso,
        metadata
    };

    let chatId = null;
    const { data: existingChat } = await selectInboxChatByPhone(db, safeReceiverPhone, userId);

    if (existingChat?.id) {
        chatId = existingChat.id;
        const existingMessages = Array.isArray(existingChat.metadata?.messages)
            ? existingChat.metadata.messages
            : [];
        await writeInboxChatSafely({ db, chatId, payload: {
            user_id: userId,
            doctor_id: userId,
            name: recipientName || 'Patient',
            patient_name: recipientName || 'Patient',
            patient_phone: safeReceiverPhone,
            status: deliveryStatus,
            last_message: messageBody,
            unread_count: 0,
            window_expires_at: null,
            whatsapp_window_expires_at: null,
            updated_at: nowIso,
            metadata: {
                ...(existingChat.metadata || {}),
                window_expires_at: null,
                whatsapp_window_expires_at: null,
                last_template: metadata,
                messages: [...existingMessages, { ...storedMessagePreview, chat_id: chatId }].slice(-50),
            },
        } });
    } else {
        const createdChat = await writeInboxChatSafely({ db, payload: {
            user_id: userId,
            doctor_id: userId,
            name: recipientName || 'Patient',
            patient_name: recipientName || 'Patient',
            phone: safeReceiverPhone,
            patient_phone: safeReceiverPhone,
            status: deliveryStatus,
            last_message: messageBody,
            unread_count: 0,
            window_expires_at: null,
            whatsapp_window_expires_at: null,
            updated_at: nowIso,
            metadata: {
                window_expires_at: null,
                whatsapp_window_expires_at: null,
                last_template: metadata,
                messages: [storedMessagePreview]
            },
        } });
        chatId = createdChat?.id || null;
    }

    if (!isUuid(chatId)) {
        console.error('Campaign inbox message skipped because no active chat id could be resolved.', {
            user_id: userId,
            receiver_phone: safeReceiverPhone,
            chat_id: chatId,
            conversation_chat_id: conversationChatId
        });
        return;
    }

    const inboxPayload = {
        chat_id: chatId,
        workspace_id: userId,
        sender_id: userId,
        sender: 'agent',
        from_me: true,
        type: 'template',
        message_type: 'text',
        status: deliveryStatus,
        is_agent: true,
        meta_message_id: getMetaMessageId(metaResult),
        message_id: getMetaMessageId(metaResult),
        body: messageBody,
        text: messageBody,
        message_body: messageBody,
        message_text: messageBody,
        sender_phone: safeSenderPhone,
        receiver_phone: safeReceiverPhone,
        is_private_note: false,
        metadata: {
            ...metadata,
            campaign_name: row.campaign_name || row.payload?.campaign_name || null,
            bulk_broadcast: true,
            conversation_chat_id: conversationChatId,
            meta_response: deliveryStatus === 'FAILED' ? 'FAILED_DISPATCH' : 'SUCCESSFUL_DISPATCH',
            campaign_triggered: true
        },
        created_at: nowIso,
    };

    const messageInsert = await safeInsertRows({
        table: 'inbox_messages',
        rows: [inboxPayload],
        pruneMissingColumns: false
    });

    if (!messageInsert.success) console.error('Campaign inbox message insert failed for chat:', chatId);
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
                    window_expires_at: null,
                    whatsapp_window_expires_at: null,
                    updated_at: new Date().toISOString()
                }).eq('phone', row.recipient_phone),
                supabase.from('wallet_transactions').insert([{
                    user_id: row.user_id || row.doctor_id,
                    amount: getUnitCost(row.template_category),
                    transaction_type: 'DEBIT',
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
                await upsertCampaignInboxMessage({
                    row,
                    metaResult: null,
                    deliveryStatus: 'FAILED',
                    deliveryError: sendError.clientPayload?.msg || sendError.message || 'Meta send failed'
                });
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
                    window_expires_at: null,
                    whatsapp_window_expires_at: null,
                    updated_at: new Date().toISOString()
                }).eq('phone', row.recipient_phone),
                supabase.from('wallet_transactions').insert([{
                    user_id: row.user_id,
                    amount: unitCost,
                    transaction_type: 'DEBIT',
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

startTrialReminderJob({
    db: supabaseAdmin || supabase,
    sendDirectEmail,
    intervalMs: Number(process.env.TRIAL_REMINDER_INTERVAL_MS || 24 * 60 * 60 * 1000)
});

if (process.env.DISABLE_META_SYNC_WORKER !== 'true') {
    startMetaSyncWorker({ supabase: supabaseAdmin || supabase });
    process.once('SIGTERM', stopMetaSyncWorker);
    process.once('SIGINT', stopMetaSyncWorker);
}

// ====== PORT LISTEN ENGINE ======
if (require.main !== module) {
  app.listen = () => app;
}
const PORT = process.env.PORT || 5000;
module.exports = app;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Yogi Desk API running safely on port ${PORT}`);
});
