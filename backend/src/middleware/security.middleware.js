// backend/src/middleware/security.middleware.js

const mongoSanitize = require('express-mongo-sanitize');
const hpp           = require('hpp');
const xss           = require('xss');

//─────────────────────────────────────
// 1. MongoDB Injection Prevention
//─────────────────────────────────────
const sanitizeMongo = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  MongoDB injection attempt blocked: ${key} from ${req.ip}`);
  },
});

//─────────────────────────────────────
// 2. HTTP Parameter Pollution Prevention
//─────────────────────────────────────
const preventHPP = hpp({
  whitelist: ['sort', 'fields', 'type', 'category', 'tags'],
});

//─────────────────────────────────────
// 3. XSS Sanitization
//─────────────────────────────────────
const sanitizeXSS = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === 'string') return xss(value);
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).reduce((acc, key) => {
        acc[key] = sanitizeValue(value[key]);
        return acc;
      }, Array.isArray(value) ? [] : {});
    }
    return value;
  };

  if (req.body)   req.body   = sanitizeValue(req.body);
  if (req.query)  req.query  = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);

  next();
};

//─────────────────────────────────────
// 4. Request Size Validator
//─────────────────────────────────────
const validateRequestSize = (req, res, next) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize       = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      message: 'Request too large. Maximum size is 10MB.',
    });
  }
  next();
};

//─────────────────────────────────────
// 5. Suspicious Activity Detector
//─────────────────────────────────────
const suspiciousPatterns = [
  /(\$where|\$regex|\$gt|\$lt|\$ne|\$in|\$nin)/i, // MongoDB operators
  /(union|select|insert|update|delete|drop|create)\s/i, // SQL patterns
  /<script[\s\S]*?>[\s\S]*?<\/script>/i,            // Script tags
  /javascript:/i,                                    // JS protocol
  /on\w+\s*=/i,                                     // Event handlers
];

const detectSuspiciousActivity = (req, res, next) => {
  const payload = JSON.stringify({
    body:   req.body,
    query:  req.query,
    params: req.params,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(payload)) {
      console.warn(`🚨 Suspicious request from ${req.ip}: ${req.method} ${req.path}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid request content detected.',
      });
    }
  }
  next();
};

//─────────────────────────────────────
// 6. API Key Header Validator
//─────────────────────────────────────
const validateApiKeyFormat = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && !apiKey.startsWith('sw_live_')) {
    return res.status(401).json({
      success: false,
      message: 'Invalid API key format.',
    });
  }
  next();
};

module.exports = {
  preventHPP,
  sanitizeXSS,
  validateRequestSize,
  detectSuspiciousActivity,
  validateApiKeyFormat,
};