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

const {
  preventHPP,
  sanitizeXSS,
  validateRequestSize,
  detectSuspiciousActivity,
  validateApiKeyFormat,
} = require('./middleware/security.middleware');

const {
  compressResponse,
  trackResponseTime,
  setCacheHeaders,
  attachRequestId,
  enforcePaginationLimits,
  collectMetrics,
  getMetrics,
} = require('./middleware/performance.middleware');

validateEnv();

const app = express();

//─────────────────────────────────────
// PERFORMANCE — first
//─────────────────────────────────────
app.use(compressResponse);
app.use(trackResponseTime);
app.use(attachRequestId);
app.use(collectMetrics);

//─────────────────────────────────────
// SECURITY HEADERS
//─────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:      ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc:  ["'self'", 'https://api.groq.com'],
    },
  },
}));

//─────────────────────────────────────
// CORS
//─────────────────────────────────────
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
  methods:      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

//─────────────────────────────────────
// LOGGING
//─────────────────────────────────────
app.use(morgan(env.isDev ? 'dev' : 'combined'));

//─────────────────────────────────────
// BODY PARSING
//─────────────────────────────────────
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(validateRequestSize);
app.use(express.json({ limit: `${env.upload.maxSizeMb}mb` }));
app.use(express.urlencoded({ extended: true, limit: `${env.upload.maxSizeMb}mb` }));
app.use('/uploads', express.static(path.join(__dirname, '..', env.upload.dir)));

//─────────────────────────────────────
// SECURITY MIDDLEWARE
//─────────────────────────────────────
app.use(preventHPP);
app.use(sanitizeXSS);
app.use(detectSuspiciousActivity);
app.use(validateApiKeyFormat);

//─────────────────────────────────────
// PERFORMANCE MIDDLEWARE
//─────────────────────────────────────
app.use(setCacheHeaders);
app.use(enforcePaginationLimits);

//─────────────────────────────────────
// RATE LIMITING
//─────────────────────────────────────
app.use('/api/', generalLimiter);

//─────────────────────────────────────
// HEALTH + METRICS
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

app.get('/metrics', (req, res) => {
  res.json({ success: true, data: getMetrics() });
});

//─────────────────────────────────────
// API ROUTES
//─────────────────────────────────────
const { aiLimiter, paymentLimiter, uploadLimiter } = require('./middleware/rateLimiter');

app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/transactions',  require('./routes/transaction.routes'));
app.use('/api/categories',    require('./routes/category.routes'));
app.use('/api/automation',    uploadLimiter, require('./routes/automation.routes'));   // Stage 5
app.use('/api/ai',            aiLimiter,     require('./routes/ai.routes'));           // Stage 6
app.use('/api/ai/advanced',   aiLimiter,     require('./routes/aiAdvanced.routes'));   // Stage 7
app.use('/api/payments',      paymentLimiter,require('./routes/payment.routes'));      // Stage 8
app.use('/api/groups',        require('./routes/group.routes'));                       // Stage 9
app.use('/api/blockchain',    require('./routes/blockchain.routes'));                  // Stage 10
app.use('/api/platform',      require('./routes/platform.routes'));                    // Stage 11
app.use('/api/notifications', require('./routes/notification.routes'));                // Stage 12

//─────────────────────────────────────
// ERROR HANDLING
//─────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;