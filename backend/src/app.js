// backend/src/app.js

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

const { validateEnv, env }       = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { generalLimiter }         = require('./middleware/rateLimiter');

validateEnv();

const app = express();

//─────────────────────────────────────
// SECURITY
//─────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = [
  env.frontend.url,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`⚠️  CORS blocked: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

//─────────────────────────────────────
// LOGGING + PARSING
//─────────────────────────────────────
app.use(morgan(env.isDev ? 'dev' : 'combined'));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: `${env.upload.maxSizeMb}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${env.upload.maxSizeMb}mb` }));
app.use('/uploads', express.static(path.join(__dirname, '..', env.upload.dir)));

//─────────────────────────────────────
// RATE LIMITING
//─────────────────────────────────────
app.use('/api/', generalLimiter);

//─────────────────────────────────────
// HEALTH CHECK
//─────────────────────────────────────
app.get('/health', async (req, res) => {
  const { testConnection } = require('./config/db');
  const dbStatus = await testConnection();
  res.json({
    success:     true,
    status:      'healthy',
    app:         'SpendWise',
    version:     '1.0.0',
    environment: env.nodeEnv,
    database:    { type: 'MongoDB', ...dbStatus },
    timestamp:   new Date().toISOString(),
  });
});

//─────────────────────────────────────
// API ROUTES
//─────────────────────────────────────
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/transactions', require('./routes/transaction.routes'));
app.use('/api/categories',   require('./routes/category.routes'));
app.use('/api/automation',   require('./routes/automation.routes'));   // Stage 5
app.use('/api/ai',           require('./routes/ai.routes'));           // Stage 6
app.use('/api/ai/advanced',  require('./routes/aiAdvanced.routes'));   // Stage 7
app.use('/api/payments',     require('./routes/payment.routes'));      // Stage 8
app.use('/api/groups',       require('./routes/group.routes'));        // Stage 9
app.use('/api/blockchain',   require('./routes/blockchain.routes'));   // Stage 10
// app.use('/api/platform', require('./routes/platform.routes'));       // Stage 11

//─────────────────────────────────────
// ERROR HANDLING
//─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;