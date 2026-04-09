// backend/src/middleware/rateLimiter.js

const rateLimit          = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { env }            = require('../config/env');

const generalLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: env.rateLimit.windowMs,
      max: env.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many requests. Please try again later.' },
    });

const authLimiter = process.env.NODE_ENV === 'test'
  ? (req, res, next) => next()  // passthrough in tests
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
    });

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many AI requests. Please wait a moment.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Upload limit reached. Try again in 1 hour.' },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many payment requests. Please wait.' },
});

const apiPlatformLimiter = rateLimit({
  windowMs:     24 * 60 * 60 * 1000,
  max:          env.apiPlatform.freeTierDailyLimit,
  keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Daily API limit reached. Upgrade your plan.' },
});

module.exports = { generalLimiter, authLimiter, aiLimiter, uploadLimiter, paymentLimiter, apiPlatformLimiter };