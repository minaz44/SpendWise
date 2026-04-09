// backend/src/models/APIKey.model.js

const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'API key name is required'],
      trim: true,
      maxlength: 100,
    },
    key: {
      type: String,
      unique: true,
      select: false,
    },
    keyPreview: {
      // Shows first 8 chars: sw_live_abcd1234...
      type: String,
    },
    tier: {
      type: String,
      enum: ['free', 'starter', 'growth', 'enterprise'],
      default: 'free',
    },
    permissions: {
      categorization: { type: Boolean, default: true },
      analysis:       { type: Boolean, default: false },
      prediction:     { type: Boolean, default: false },
      score:          { type: Boolean, default: false },
      suggestions:    { type: Boolean, default: false },
    },
    rateLimit: {
      daily:   { type: Number, default: 100 },
      monthly: { type: Number, default: 1000 },
    },
    usage: {
      totalCalls:   { type: Number, default: 0 },
      dailyCalls:   { type: Number, default: 0 },
      monthlyCalls: { type: Number, default: 0 },
      lastResetDay: { type: Date, default: Date.now },
      lastResetMonth:{ type: Date, default: Date.now },
    },
    isActive:   { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
    expiresAt:  { type: Date, default: null },
    allowedDomains: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Generate API key before saving
// ✅ FIXED
apiKeySchema.pre('save', function () {
  if (!this.key) {
    const rawKey = `sw_live_${crypto.randomBytes(24).toString('hex')}`;
    this.key = rawKey;
    this.keyPreview = rawKey.slice(0, 16) + '...';
  }
});

// Reset daily usage
apiKeySchema.methods.resetDailyIfNeeded = async function () {
  const today = new Date();
  const lastReset = new Date(this.usage.lastResetDay);
  if (today.toDateString() !== lastReset.toDateString()) {
    this.usage.dailyCalls = 0;
    this.usage.lastResetDay = today;
    await this.save();
  }
};

apiKeySchema.index({ key: 1 });
apiKeySchema.index({ userId: 1 });

const APIKey = mongoose.model('APIKey', apiKeySchema);
module.exports = APIKey;