require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');

// Port automatic Hostinger decide karega, local par 5000
const PORT = process.env.PORT || 5000;

// Body parser jisse Meta aur Supabase ka data read ho sake
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
