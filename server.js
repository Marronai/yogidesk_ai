require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const paymentRoutes = require('./backend/routes/paymentRoutes');
const authRoutes = require('./backend/routes/authRoutes');
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
