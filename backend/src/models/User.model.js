// backend/src/models/User.model.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    avatar:   { type: String, default: null },
    phone:    { type: String, default: null, trim: true },
    currency: { type: String, default: 'INR', enum: ['INR', 'USD', 'EUR', 'GBP', 'AED'] },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    monthlyIncome: { type: Number, default: 0, min: 0 },
    plan:          { type: String, enum: ['free', 'premium'], default: 'free' },
    planExpiresAt: { type: Date, default: null },

    // Wallet for blockchain
    walletAddress: { type: String, default: null, trim: true },

    // Financial score cache
    financialScore: {
      score:          { type: Number, default: null },
      grade:          { type: String, default: null },
      lastCalculated: { type: Date,   default: null },
    },

    // Notification preferences
    notifications: {
      email:         { type: Boolean, default: true },
      budgetAlerts:  { type: Boolean, default: true },
      weeklyReport:  { type: Boolean, default: true },
      anomalyAlerts: { type: Boolean, default: true },
    },

    // SMS parsing settings
    smsTracking: {
      enabled: { type: Boolean, default: false },
      phone:   { type: String,  default: null },
    },

    // ── Email Verification (OTP) ──────────────────────────────────────────
    isEmailVerified:      { type: Boolean, default: false },
    emailVerifyOTP:       { type: String,  default: null, select: false },
    emailVerifyOTPExpiry: { type: Date,    default: null, select: false },

    // ── Friend Requests ───────────────────────────────────────────────────
    // Friends are stored as an array of user IDs (accepted connections)
    friends: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],

    // Incoming friend requests (people who sent YOU a request)
    friendRequestsReceived: [{
      from:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      sentAt:    { type: Date, default: Date.now },
    }],

    // Outgoing friend requests (people YOU sent a request to)
    friendRequestsSent: [{
      to:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      sentAt: { type: Date, default: Date.now },
    }],

    isActive:    { type: Boolean, default: true },
    lastLoginAt: { type: Date,    default: null },

    refreshToken: { type: String, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Hash password before saving ───────────────────────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Compare password ──────────────────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Virtual: initials ─────────────────────────────────────────────────────────
userSchema.virtual('initials').get(function () {
  return this.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
});

// ── Virtual: isPremium ────────────────────────────────────────────────────────
userSchema.virtual('isPremium').get(function () {
  if (this.plan !== 'premium') return false;
  if (!this.planExpiresAt) return true;
  return new Date() < this.planExpiresAt;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ walletAddress: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);
module.exports = User;