const rateLimit = require('express-rate-limit');

const PRODUCTION_ORIGINS = [
  'https://yogidesk-ai.com',
  'https://www.yogidesk-ai.com',
];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

// Fixed WebView origins used by packaged Capacitor applications. These are not
// development servers; Android defaults to http://localhost and iOS commonly
// reports capacitor://localhost.
const NATIVE_APP_ORIGINS = [
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
];

const CORS_ALLOWED_METHODS = 'GET, POST, OPTIONS, PUT, PATCH, DELETE';
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization, X-YogiDesk-User-Email, X-Hub-Signature-256, X-Requested-With';
const CORS_ALLOWED_ORIGINS = new Set([
  ...PRODUCTION_ORIGINS,
  ...DEVELOPMENT_ORIGINS,
  ...NATIVE_APP_ORIGINS,
]);

const resolveCorsOrigin = (origin) => {
  if (!origin) return PRODUCTION_ORIGINS[0];
  return CORS_ALLOWED_ORIGINS.has(origin) ? origin : '';
};

const buildCorsOptions = () => ({
  origin: (origin, callback) => {
    const allowedOrigin = resolveCorsOrigin(origin);
    if (!origin || allowedOrigin) return callback(null, allowedOrigin || true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: CORS_ALLOWED_METHODS,
  allowedHeaders: CORS_ALLOWED_HEADERS,
  credentials: true,
  optionsSuccessStatus: 204,
});

const applyCorsHeaders = (req, res, next) => {
  const allowedOrigin = resolveCorsOrigin(req.headers.origin);
  const method = String(req.method || 'GET').toUpperCase();
  const hasUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (req.headers.origin && !allowedOrigin && hasUnsafeMethod && !isWebhookRequest(req)) {
    return res.status(403).json({ success: false, message: 'Origin is not allowed.' });
  }

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
};

const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://embed.tawk.to https://*.tawk.to",
      "connect-src 'self' https: wss:",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.tawk.to",
    ].join('; ')
  );
  return next();
};

const isWebhookRequest = (req = {}) => {
  const path = String(req.originalUrl || req.url || '').toLowerCase();
  return path.startsWith('/api/webhooks/whatsapp') ||
    path.startsWith('/api/whatsapp-webhook') ||
    path.startsWith('/api/webhook/meta') ||
    path.startsWith('/api/payments/razorpay-webhook') ||
    path.startsWith('/api/payment/razorpay-webhook');
};

const createApiRateLimiter = () => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 900,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isWebhookRequest,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

module.exports = {
  CORS_ALLOWED_HEADERS,
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_ORIGINS,
  applyCorsHeaders,
  buildCorsOptions,
  createApiRateLimiter,
  isWebhookRequest,
  resolveCorsOrigin,
  securityHeaders,
};
