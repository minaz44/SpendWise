// backend/src/models/AuditTrail.model.js

const mongoose = require('mongoose');

const auditTrailSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },

    // The core hash of this transaction's data
    hash: {
      type: String,
      required: true,
      unique: true,
    },

    // Previous hash — creates the chain
    previousHash: {
      type: String,
      default: '0000000000000000000000000000000000000000000000000000000000000000',
    },

    // Chain hash — hash of (hash + previousHash) — tamper detection
    chainHash: {
      type: String,
      required: true,
    },

    // Snapshot of transaction data at time of hashing
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
    },

    // Block number in our local chain
    blockIndex: {
      type:     Number,
      required: true,
    },

    // Polygon on-chain data (filled when wallet is connected)
    onChain: {
      txHash:      { type: String, default: null },
      blockNumber: { type: Number, default: null },
      network:     { type: String, default: null },
      submittedAt: { type: Date,   default: null },
      isOnChain:   { type: Boolean, default: false },
    },

    isVerified: { type: Boolean, default: true },
    tampered:   { type: Boolean, default: false },
  },
  {
    timestamps: true,
    // Immutable — no updates allowed
    strict: true,
  }
);

// Indexes
auditTrailSchema.index({ userId: 1, blockIndex: -1 });
auditTrailSchema.index({ transactionId: 1 }, { unique: true });
auditTrailSchema.index({ hash: 1 });
auditTrailSchema.index({ chainHash: 1 });

const AuditTrail = mongoose.model('AuditTrail', auditTrailSchema);
module.exports = AuditTrail;