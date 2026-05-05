require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');

// Initialize Express app first
const app = express();
app.set('trust proxy', 1);

// Database Connection
const connectDB = require('./config/db');
connectDB();

// Passport Config
try {
  require('./config/passport')(passport);
  console.log('✅ Passport configured successfully');
} catch (error) {
  console.error('❌ Passport configuration error:', error.message);
}

const corsOptions = {
  origin: 'https://yogidesk-ai.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  optionsSuccessStatus: 200
};

// Enable CORS before any other middleware or routes
app.use(cors(corsOptions));

// Manual OPTIONS handler for preflight requests (Enhanced)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', 'https://yogidesk-ai.com');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
    return res.sendStatus(200);
  }
  next();
});

// CORS + Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session Setup
app.use(session({
  secret: process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Request Body Logger
app.use((req, res, next) => {
  console.log(`📩 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.method === 'POST') console.log('Body:', req.body);
  next();
});

// API Routes
try {
  app.use('/api/auth', require('./routes/authRoutes'));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
}

try {
  app.use('/api/whatsapp', require('./routes/whatsappRoutes'));
  console.log('✅ WhatsApp routes loaded');
} catch (error) {
  console.error('❌ Failed to load whatsapp routes:', error.message);
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ msg: 'API endpoint not found' });
});

// Error Handler (Last)
app.use((err, req, res, next) => {
  console.error('🔥 ERROR:', err.message);
  console.error(err.stack);
  res.status(500).json({
    msg: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
