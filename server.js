require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const paymentRoutes = require('./backend/routes/paymentRoutes');
const authRoutes = require('./backend/routes/authRoutes');
const { supabase, supabaseAdmin } = require('./backend/config/supabase');
const { getBearerToken, isJwtSegmentToken } = require('./backend/utils/tokenGuards');
const { isMetaReviewerEmail } = require('./backend/services/metaReviewerAccountService');
const {
    applyCorsHeaders,
    buildCorsOptions,
    createApiRateLimiter,
    securityHeaders
} = require('./backend/utils/httpSecurity');

// Port automatic Hostinger decide karega, local par 5000
const PORT = process.env.PORT || 5000;

const corsOptions = buildCorsOptions();
const isWhatsAppWebhookBodyRoute = (req = {}) => {
    const originalUrl = String(req.originalUrl || req.url || '');
    return originalUrl.startsWith('/api/webhooks/whatsapp') ||
        originalUrl.startsWith('/api/whatsapp-webhook') ||
        originalUrl.startsWith('/api/webhook/meta');
};

// Body parser jisse Meta aur Supabase ka data read ho sake
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(applyCorsHeaders);
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use('/api', createApiRateLimiter());
app.use(express.json({
    limit: process.env.JSON_BODY_LIMIT || '5mb',
    type: (req) => (
        isWhatsAppWebhookBodyRoute(req) ||
        Boolean(req.is(['application/json', 'application/*+json']))
    ),
    verify: (req, res, buf, encoding) => {
        if (isWhatsAppWebhookBodyRoute(req)) {
            req.rawBody = buf.toString(encoding || 'utf8');
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));

const normalizeEmbeddedSignupConfigId = (value) => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';
    if (/^\d+$/.test(rawValue)) return rawValue;
    try {
        const url = new URL(rawValue);
        const configId = url.searchParams.get('config_id') || url.searchParams.get('configuration_id');
        return /^\d+$/.test(String(configId || '')) ? configId : '';
    } catch {
        const match = rawValue.match(/[?&](?:config_id|configuration_id)=(\d+)/i);
        return match?.[1] || '';
    }
};

const isMissingColumnError = (error) => {
    const message = String(`${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`).toLowerCase();
    return error?.code === '42703' || error?.code === 'PGRST204' || message.includes('column') || message.includes('schema cache');
};

const extractMissingPayloadColumn = (error) => {
    const text = String(`${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`);
    const quoted = text.match(/'([^']+)'\s+column/i);
    if (quoted?.[1]) return quoted[1];
    const doubleQuoted = text.match(/column\s+"([^"]+)"/i);
    if (doubleQuoted?.[1]) return doubleQuoted[1];
    const cache = text.match(/schema cache.*?['"]([^'"]+)['"]/i);
    return cache?.[1] || '';
};

const sanitizeMetaId = (value) => String(value || '').trim().replace(/[^\w.-]/g, '');

const getSupabaseSessionUser = async (req) => {
    const token = getBearerToken(req);
    if (!token || !isJwtSegmentToken(token)) return null;
    const client = supabaseAdmin || supabase;
    if (!client?.auth?.getUser) return null;
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user;
};

const upsertDoctorMetaConnectionSafely = async ({ userId, payload }) => {
    const db = supabaseAdmin || supabase;
    let safePayload = { id: userId, ...payload };
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const { error } = await db.from('doctor_profiles').upsert(safePayload, { onConflict: 'id' });
        if (!error) return;
        const missingColumn = extractMissingPayloadColumn(error);
        if (!isMissingColumnError(error) || !missingColumn || !Object.prototype.hasOwnProperty.call(safePayload, missingColumn)) {
            throw error;
        }
        const { [missingColumn]: _removed, ...nextPayload } = safePayload;
        safePayload = nextPayload;
    }
    throw new Error('Meta connection save retry limit reached.');
};

const exchangeEmbeddedSignupCode = async (code) => {
    const appId = String(process.env.META_APP_ID || process.env.VITE_META_APP_ID || '').trim();
    const appSecret = String(process.env.META_APP_SECRET || '').trim();
    if (!appId || !appSecret) throw new Error('Meta app credentials are not configured on the server.');
    const response = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
        params: { client_id: appId, client_secret: appSecret, code },
        timeout: 15000,
        validateStatus: (status) => status >= 200 && status < 300
    });
    const accessToken = String(response.data?.access_token || '').trim();
    if (!accessToken) throw new Error('Meta did not return a system user access token.');
    return accessToken;
};

const validateMetaCredentials = async ({ phoneNumberId, businessAccountId, accessToken }) => {
    await axios.get(`https://graph.facebook.com/v21.0/${phoneNumberId}`, {
        params: { fields: 'id,display_phone_number,verified_name' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 300
    });
    await axios.get(`https://graph.facebook.com/v21.0/${businessAccountId}`, {
        params: { fields: 'id,name' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
        validateStatus: (status) => status >= 200 && status < 300
    });
};

const subscribeEmbeddedSignupWaba = async ({ businessAccountId, accessToken }) => {
    if (process.env.META_EMBEDDED_SIGNUP_SUBSCRIBE_APP === 'false') return;
    try {
        await axios.post(`https://graph.facebook.com/v21.0/${businessAccountId}/subscribed_apps`, null, {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 10000,
            validateStatus: (status) => status >= 200 && status < 300
        });
    } catch (error) {
        console.warn('Root Meta embedded signup subscribed_apps step skipped:', error.response?.data || error.message || error);
    }
};

const handleMetaEmbeddedSignupConfig = async (req, res) => {
    const sessionUser = await getSupabaseSessionUser(req);
    if (!sessionUser?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (isMetaReviewerEmail(sessionUser.email)) return res.status(200).json({ success: true, skipped: true, data: {} });
    const appId = String(process.env.META_APP_ID || process.env.VITE_META_APP_ID || '').trim();
    const configId = normalizeEmbeddedSignupConfigId(
        process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ||
        process.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID ||
        process.env.META_EMBEDDED_SIGNUP_URL ||
        ''
    );
    if (!appId || !configId) return res.status(500).json({ success: false, message: 'Meta Embedded Signup is not configured on the server.' });
    return res.status(200).json({ success: true, data: { appId, configId } });
};

const handleMetaEmbeddedSignupComplete = async (req, res) => {
    try {
        const sessionUser = await getSupabaseSessionUser(req);
        if (!sessionUser?.id) return res.status(401).json({ success: false, message: 'Unauthorized' });
        if (isMetaReviewerEmail(sessionUser.email)) return res.status(200).json({ success: true, skipped: true });

        const code = String(req.body?.code || '').trim();
        const phoneNumberId = sanitizeMetaId(req.body?.phoneNumberId || req.body?.phone_number_id);
        const businessAccountId = sanitizeMetaId(req.body?.businessAccountId || req.body?.wabaId || req.body?.waba_id || req.body?.whatsapp_business_account_id);
        const businessId = sanitizeMetaId(req.body?.businessId || req.body?.business_id);

        if (!code) return res.status(400).json({ success: false, message: 'Meta authorization code is required.' });
        if (!phoneNumberId || !businessAccountId) {
            return res.status(400).json({ success: false, message: 'Meta signup did not return phone number ID and WABA ID.' });
        }

        const accessToken = await exchangeEmbeddedSignupCode(code);
        await validateMetaCredentials({ phoneNumberId, businessAccountId, accessToken });
        await subscribeEmbeddedSignupWaba({ businessAccountId, accessToken });
        await upsertDoctorMetaConnectionSafely({
            userId: sessionUser.id,
            payload: {
                email: sessionUser.email || null,
                meta_phone_number_id: phoneNumberId,
                meta_waba_id: businessAccountId,
                system_user_token: accessToken,
                whatsapp_phone_number_id: phoneNumberId,
                whatsapp_business_account_id: businessAccountId,
                whatsapp_access_token: accessToken,
                meta_business_manager_id: businessId || null,
                whatsapp_business_id: businessId || null,
                meta_configured: true,
                meta_connection_source: 'embedded_signup',
                meta_embedded_signup_connected_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        });

        return res.status(200).json({
            success: true,
            message: 'WhatsApp connected successfully.',
            data: {
                meta_phone_number_id: phoneNumberId,
                meta_waba_id: businessAccountId,
                meta_business_manager_id: businessId,
                meta_configured: true,
                is_locked: true
            }
        });
    } catch (error) {
        console.error('Root Meta embedded signup completion failed:', error.response?.data || error.message || error);
        return res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.error?.message || error.message || 'Unable to complete WhatsApp connection.'
        });
    }
};

app.get('/api/settings/meta-embedded-signup/config', handleMetaEmbeddedSignupConfig);
app.get('/settings/meta-embedded-signup/config', handleMetaEmbeddedSignupConfig);
app.post('/api/settings/meta-embedded-signup/complete', handleMetaEmbeddedSignupComplete);
app.post('/settings/meta-embedded-signup/complete', handleMetaEmbeddedSignupComplete);

app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
    return res.status(200).json({ success: true, message: "Yogi Desk API Service Online" });
});
app.use('/api/payments', paymentRoutes);
app.use('/api/payment', paymentRoutes);

console.log("🚀 Yogi Desk Root Engine Initializing...");

// Hum direct backend routes ko import kar lete hain
try {
    const backendServer = require('./backend/server.js');
    // Agar backend/server.js khud ek express app export karta hai, toh use use kar lenge
    app.use('/', backendServer);
} catch (err) {
    console.error("❌ Error loading backend routing:", err.message);
}

// Ek test route taaki browser mein pata chale ki server 100% zinda hai
app.get('/api/health-check', (req, res) => {
    res.status(200).json({ status: "alive", message: "Yogi Desk Backend is running smoothly!" });
});

app.listen(PORT, () => {
    console.log(`✅ Root Server safely listening on port ${PORT}`);
});
