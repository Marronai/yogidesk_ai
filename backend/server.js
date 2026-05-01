const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars FIRST
dotenv.config();

// Connect Database
connectDB();

const app = express();

// --- CORS Configuration ---
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://yogidesk-ai.vercel.app',
  /vercel\.app$/
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    })) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Preflight

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`📩 ${req.method} ${req.url}`);
  next();
});

// Health Check Route (IMPORTANT for Render!)
app.get('/', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// --- API ROUTES ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/team', require('./routes/teamRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
app.use('/api/templates', require('./routes/templateRoutes'));

// --- 404 Handler ---
app.use((req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`);
  res.status(404).json({ msg: 'API endpoint not found' });
});

// --- Error Handler ---
app.use((err, req, res, next) => {
  console.error('🔥 ERROR:', err.message);
  console.error(err.stack);
  res.status(500).json({ 
    msg: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});