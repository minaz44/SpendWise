// backend/src/middleware/apiAuth.middleware.js

const APIKey      = require('../models/APIKey.model');
const APIUsageLog = require('../models/APIUsageLog.model');

//─────────────────────────────────────
// Authenticate API Key
//─────────────────────────────────────
const authenticateAPIKey = async (req, res, next) => {
  const startTime = Date.now();
  const apiKey    = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required. Pass it in X-API-Key header.',
    });
  }

  // Find key
  const key = await APIKey.findOne({ key: apiKey, isActive: true }).select('+key');

  if (!key) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or revoked API key.',
    });
  }

  // Check expiry
  if (key.expiresAt && new Date() > key.expiresAt) {
    return res.status(401).json({
      success: false,
      message: 'API key has expired.',
    });
  }

  // Reset daily usage if needed
  await key.resetDailyIfNeeded();

  // Check daily limit
  if (key.usage.dailyCalls >= key.rateLimit.daily) {
    return res.status(429).json({
      success: false,
      message: `Daily limit reached (${key.rateLimit.daily} calls). Resets at midnight.`,
      data: {
        limit:     key.rateLimit.daily,
        used:      key.usage.dailyCalls,
        resetAt:   'midnight',
      },
    });
  }

  // Check monthly limit
  if (key.usage.monthlyCalls >= key.rateLimit.monthly) {
    return res.status(429).json({
      success: false,
      message: `Monthly limit reached (${key.rateLimit.monthly} calls).`,
    });
  }

  // Update usage
  key.usage.totalCalls++;
  key.usage.dailyCalls++;
  key.usage.monthlyCalls++;
  key.lastUsedAt = new Date();
  await key.save();

  // Attach to request
  req.apiKey   = key;
  req.apiUser  = { _id: key.userId };

  // Log usage after response
  res.on('finish', async () => {
    try {
      await APIUsageLog.create({
        apiKeyId:     key._id,
        userId:       key.userId,
        endpoint:     req.originalUrl,
        method:       req.method,
        statusCode:   res.statusCode,
        responseTime: Date.now() - startTime,
        ipAddress:    req.ip,
        userAgent:    req.headers['user-agent'],
      });
    } catch (_) {}
  });

  next();
};

//─────────────────────────────────────
// Check permission for endpoint
//─────────────────────────────────────
const requirePermission = (permission) => (req, res, next) => {
  if (!req.apiKey?.permissions?.[permission]) {
    return res.status(403).json({
      success: false,
      message: `Your API key tier does not have '${permission}' permission. Upgrade your plan.`,
      upgradeUrl: '/api/platform/tiers',
    });
  }
  next();
};

module.exports = { authenticateAPIKey, requirePermission };