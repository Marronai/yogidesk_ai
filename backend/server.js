require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const passport = require('passport');
const session = require('express-session');

const app = express();

const corsOptions = {
  origin: ['https://yogidesk-ai.com', 'https://www.yogidesk-ai.com', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 1. Database Connection
connectDB();

// 2. Passport Config
require('./config/passport')(passport);

// 3. CORS + Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 5. Session Setup
app.use(session({
  secret: process.env.JWT_SECRET || 'YogiDesk_Temporary_Secret_Key_9988',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// 6. Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// 7. Request Body Logger
app.use((req, res, next) => {
  console.log(`📩 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.method === 'POST') console.log('Body:', req.body);
  next();
});

// 8. API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));
// ... (Add other routes as per your file)

// 9. 404 Handler
app.use((req, res) => {
  res.status(404).json({ msg: 'API endpoint not found' });
});

// 10. Error Handler (Last)
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