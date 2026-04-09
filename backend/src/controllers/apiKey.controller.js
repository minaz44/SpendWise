// backend/src/controllers/apiKey.controller.js

const APIKey      = require('../models/APIKey.model');
const APIUsageLog = require('../models/APIUsageLog.model');

//─────────────────────────────────────
// TIER CONFIG
//─────────────────────────────────────
const TIER_CONFIG = {
  free: {
    daily:       100,
    monthly:     1000,
    permissions: { categorization: true, analysis: false, prediction: false, score: false, suggestions: false },
  },
  starter: {
    daily:       1000,
    monthly:     10000,
    permissions: { categorization: true, analysis: true, prediction: false, score: true, suggestions: false },
  },
  growth: {
    daily:       10000,
    monthly:     100000,
    permissions: { categorization: true, analysis: true, prediction: true, score: true, suggestions: true },
  },
  enterprise: {
    daily:       999999,
    monthly:     999999,
    permissions: { categorization: true, analysis: true, prediction: true, score: true, suggestions: true },
  },
};

//─────────────────────────────────────
// POST /api/platform/keys
// Generate new API key
//─────────────────────────────────────
const createKey = async (req, res, next) => {
  try {
    const { name, tier, allowedDomains } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'API key name is required.' });
    }

    // Max 5 keys per user
    const count = await APIKey.countDocuments({ userId: req.user._id, isActive: true });
    if (count >= 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 API keys allowed per account.',
      });
    }

    const selectedTier = TIER_CONFIG[tier] ? tier : 'free';
    const config       = TIER_CONFIG[selectedTier];

    const apiKey = await APIKey.create({
      userId:         req.user._id,
      name,
      tier:           selectedTier,
      permissions:    config.permissions,
      rateLimit:      { daily: config.daily, monthly: config.monthly },
      allowedDomains: allowedDomains || [],
    });

    // Fetch with key visible (only shown once)
    const keyWithSecret = await APIKey.findById(apiKey._id).select('+key');

    return res.status(201).json({
      success: true,
      message: '⚠️ Save this key now — it will never be shown again.',
      data: {
        id:         keyWithSecret._id,
        name:       keyWithSecret.name,
        key:        keyWithSecret.key,
        keyPreview: keyWithSecret.keyPreview,
        tier:       keyWithSecret.tier,
        rateLimit:  keyWithSecret.rateLimit,
        permissions:keyWithSecret.permissions,
        createdAt:  keyWithSecret.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/platform/keys
// List all API keys (without secret)
//─────────────────────────────────────
const listKeys = async (req, res, next) => {
  try {
    const keys = await APIKey.find({ userId: req.user._id, isActive: true })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { keys, total: keys.length },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// DELETE /api/platform/keys/:id
// Revoke API key
//─────────────────────────────────────
const revokeKey = async (req, res, next) => {
  try {
    const key = await APIKey.findOne({ _id: req.params.id, userId: req.user._id });

    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found.' });
    }

    key.isActive = false;
    await key.save();

    return res.status(200).json({
      success: true,
      message: 'API key revoked successfully.',
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/platform/keys/:id/usage
// Get usage stats for a key
//─────────────────────────────────────
const getKeyUsage = async (req, res, next) => {
  try {
    const key = await APIKey.findOne({ _id: req.params.id, userId: req.user._id });

    if (!key) {
      return res.status(404).json({ success: false, message: 'API key not found.' });
    }

    // Last 7 days usage
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const logs = await APIUsageLog.aggregate([
      { $match: { apiKeyId: key._id, createdAt: { $gte: since } } },
      {
        $group: {
          _id:          { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          calls:        { $sum: 1 },
          avgResponse:  { $avg: '$responseTime' },
          errors:       { $sum: { $cond: [{ $gte: ['$statusCode', 400] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topEndpoints = await APIUsageLog.aggregate([
      { $match: { apiKeyId: key._id } },
      { $group: { _id: '$endpoint', calls: { $sum: 1 } } },
      { $sort: { calls: -1 } },
      { $limit: 5 },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        key: {
          id:          key._id,
          name:        key.name,
          tier:        key.tier,
          keyPreview:  key.keyPreview,
          usage:       key.usage,
          rateLimit:   key.rateLimit,
          lastUsedAt:  key.lastUsedAt,
        },
        dailyUsage:   logs,
        topEndpoints,
        utilizationRate: key.rateLimit.daily > 0
          ? parseFloat(((key.usage.dailyCalls / key.rateLimit.daily) * 100).toFixed(1))
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

//─────────────────────────────────────
// GET /api/platform/dashboard
// Platform overview dashboard
//─────────────────────────────────────
const getPlatformDashboard = async (req, res, next) => {
  try {
    const keys = await APIKey.find({ userId: req.user._id }).lean();

    const totalCalls   = keys.reduce((s, k) => s + k.usage.totalCalls, 0);
    const dailyCalls   = keys.reduce((s, k) => s + k.usage.dailyCalls, 0);
    const monthlyCalls = keys.reduce((s, k) => s + k.usage.monthlyCalls, 0);

    // Recent logs
    const recentLogs = await APIUsageLog.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Monthly trend
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const trend = await APIUsageLog.aggregate([
      { $match: { userId: req.user._id, createdAt: { $gte: since } } },
      {
        $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          calls: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalKeys:    keys.length,
          activeKeys:   keys.filter(k => k.isActive).length,
          totalCalls,
          dailyCalls,
          monthlyCalls,
        },
        keys:       keys.map(k => ({
          id:         k._id,
          name:       k.name,
          tier:       k.tier,
          keyPreview: k.keyPreview,
          dailyCalls: k.usage.dailyCalls,
          dailyLimit: k.rateLimit.daily,
          isActive:   k.isActive,
          lastUsedAt: k.lastUsedAt,
        })),
        recentLogs,
        trend,
        tiers: TIER_CONFIG,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createKey, listKeys, revokeKey, getKeyUsage, getPlatformDashboard };