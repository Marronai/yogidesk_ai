const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Config & DB Load
require('dotenv').config();
connectDB();

const app = express();

// --- 1. GLOBAL MIDDLEWARES (Order is Very Important) ---

// ✅✅✅ A. CORS FIX (UPDATED) ✅✅✅
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://yogidesk-ai.vercel.app',
    /vercel\.app$/ // All Vercel preview URLs allowed
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// B. JSON Parser
app.use(express.json());

// C. Debug Logger
app.use((req, res, next) => {
  console.log(`📩 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// --- 2. ROUTE DEFINITIONS ---

// Auth Routes
app.use('/api/auth', require('./routes/authRoutes'));

// Payment Routes
app.use('/api/payments', require('./routes/paymentRoutes'));

// Settings Routes
app.use('/api/settings', require('./routes/settingsRoutes'));

// WhatsApp Routes
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

// Team Routes
app.use('/api/team', require('./routes/teamRoutes'));

// Contact/Audience Routes
app.use('/api/contacts', require('./routes/contactRoutes'));

// Template Routes
app.use('/api/templates', require('./routes/templateRoutes'));

// --- 3. ERROR HANDLING & 404 ---

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ msg: "API endpoint not found" });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Server Error:", err.stack);
  res.status(500).json({ msg: "Something went wrong on the server" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Yogidesk Server Active on Port ${PORT}`));