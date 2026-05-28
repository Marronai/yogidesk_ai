require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });
const paymentRoutes = require('./backend/routes/paymentRoutes');

// Port automatic Hostinger decide karega, local par 5000
const PORT = process.env.PORT || 5000;

const corsOptions = {
    origin: ['https://yogidesk-ai.com', 'http://yogidesk-ai.com', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Body parser jisse Meta aur Supabase ka data read ho sake
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/payments', paymentRoutes);

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
