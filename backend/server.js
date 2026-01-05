const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Config & DB Load
require('dotenv').config();
connectDB();

const app = express();

// --- 1. GLOBAL MIDDLEWARES (Order is Very Important) ---

// A. CORS: Allow cross-origin requests
app.use(cors({ origin: true, credentials: true })); 

// B. JSON Parser: ⚠️ ISKO ROUTES SE PEHLE HONA CHAHIYE (Fixed)
app.use(express.json()); 

// C. Debug Logger: Request aate hi console mein dikhega
app.use((req, res, next) => {
  console.log(`📩 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// --- 2. ROUTE DEFINITIONS ---

// Auth Routes (Login, Signup)
app.use('/api/auth', require('./routes/authRoutes'));

// Payment Routes (Cashfree)
app.use('/api/payments', require('./routes/paymentRoutes'));

// Settings Routes (Profile, Password)
app.use('/api/settings', require('./routes/settingsRoutes'));

// WhatsApp Routes (Meta API)
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

// Team Routes (Roles, Agents Management)
app.use('/api/team', require('./routes/teamRoutes'));

// Contact/Audience Routes (With CSV Upload)
app.use('/api/contacts', require('./routes/contactRoutes'));

// Template Routes (WA Approved Templates)
app.use('/api/templates', require('./routes/templateRoutes'));
app.use('/api/contacts', require('./routes/contactRoutes'));
// Dashboard Stats (Agar file banayi hai toh uncomment karein)
// app.use('/api/dashboard', require('./routes/dashboardRoutes'));


// --- 3. ERROR HANDLING & 404 ---

// Agar koi route na mile (404)
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