// backend/src/models/Split.model.js

const mongoose = require('mongoose');

const splitSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      required: true,
    },
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: null },
    totalAmount: { type: Number, required: true, min: 0.01 },
    currency:    { type: String, default: 'INR' },
    category:    { type: String, default: 'General' },
    date:        { type: Date, default: Date.now },
    splitType: {
      type: String,
      enum: ['equal', 'custom', 'percentage'],
      default: 'equal',
    },
    shares: [
      {
        userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name:       { type: String, required: true },
        amount:     { type: Number, required: true },
        percentage: { type: Number, default: null },
        isPaid:     { type: Boolean, default: false },
        paidAt:     { type: Date, default: null },
        settlementTxHash: { type: String, default: null },
      },
    ],
    isSettled:   { type: Boolean, default: false },
    settledAt:   { type: Date, default: null },

    // Blockchain
    blockchainData: {
      txHash:         { type: String,  default: null },
      blockNumber:    { type: Number,  default: null },
      settledOnChain: { type: Boolean, default: false },
    },

    // ── Bill image (uploaded receipt / invoice) ───────────────────────────────
    billImage: { type: String, default: null },

    // ── Comments thread ───────────────────────────────────────────────────────
    comments: [
      {
        userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName:  { type: String, required: true },
        text:      { type: String, required: true, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

splitSchema.virtual('pendingAmount').get(function () {
  return this.shares
    .filter(s => !s.isPaid)
    .reduce((sum, s) => sum + s.amount, 0);
});

splitSchema.index({ groupId: 1, date: -1 });
splitSchema.index({ paidBy: 1 });
splitSchema.index({ 'shares.userId': 1 });

const Split = mongoose.model('Split', splitSchema);
module.exports = Split;