// backend/src/models/Transaction.model.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      enum: ['expense', 'income', 'transfer'],
      required: [true, 'Transaction type is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    merchant: {
      type: String,
      trim: true,
      maxlength: [100, 'Merchant name too long'],
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description too long'],
      default: null,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    categoryName: {
      // Denormalized for fast queries
      type: String,
      default: 'Uncategorized',
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
    },
    paymentMethod: {
      type: String,
      enum: ['upi', 'cash', 'card', 'netbanking', 'wallet', 'cheque', 'other'],
      default: 'other',
    },
    source: {
      type: String,
      enum: ['manual', 'sms', 'ocr', 'csv', 'pdf', 'razorpay', 'api', 'group'], // ← 'group' added
      default: 'manual',
    },

    // SMS parsing metadata
    smsData: {
      rawMessage:   { type: String, default: null },
      parsedAt:     { type: Date,   default: null },
      upiId:        { type: String, default: null },
      bankName:     { type: String, default: null },
      refNumber:    { type: String, default: null },
    },

    // OCR metadata
    ocrData: {
      receiptUrl:   { type: String, default: null },
      ipfsHash:     { type: String, default: null },
      confidence:   { type: Number, default: null },
      rawText:      { type: String, default: null },
    },

    // AI categorization metadata
    aiData: {
      categorizedBy:  { type: String, enum: ['ai', 'user', 'rule'], default: 'user' },
      confidence:     { type: Number, default: null },
      suggestedCategory: { type: String, default: null },
      isAnomaly:      { type: Boolean, default: false },
      anomalyReason:  { type: String, default: null },
    },

    // Payment gateway metadata
    paymentData: {
      razorpayOrderId:   { type: String, default: null },
      razorpayPaymentId: { type: String, default: null },
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: null,
      },
    },

    // Blockchain audit
    blockchainData: {
      txHash:      { type: String, default: null },
      blockNumber: { type: Number, default: null },
      network:     { type: String, default: null },
      auditedAt:   { type: Date,   default: null },
    },

    // Group split reference
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    splitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Split',
      default: null,
    },

    // ── GROUP EXPENSE TRACKING ──────────────────────────────────────────────
    // true when this transaction was auto-created from a group split payment
    isGroupExpense: {
      type: Boolean,
      default: false,
    },
    // Stores split details so the dashboard can show "you'll get back ₹X"
    groupExpenseMeta: {
      groupId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Group',  default: null },
      groupName:        { type: String,  default: null },
      splitId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Split',  default: null },
      splitTitle:       { type: String,  default: null },
      amountToGetBack:  { type: Number,  default: 0 },   // what others owe the payer
      myShare:          { type: Number,  default: 0 },   // payer's personal portion
      memberCount:      { type: Number,  default: 0 },   // total people in the split
    },
    // ────────────────────────────────────────────────────────────────────────

    // Recurring detection
    isRecurring: { type: Boolean, default: false },
    recurringId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RecurringTransaction',
      default: null,
    },

    tags: {
      type: [String],
      default: [],
    },

    notes: {
      type: String,
      default: null,
      maxlength: [1000, 'Notes too long'],
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,   default: null },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for fast queries
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, categoryId: 1 });
transactionSchema.index({ userId: 1, isDeleted: 1 });
transactionSchema.index({ userId: 1, date: -1, type: 1 });
transactionSchema.index({ 'smsData.refNumber': 1 });
transactionSchema.index({ 'paymentData.razorpayPaymentId': 1 });
transactionSchema.index({ groupId: 1 });
transactionSchema.index({ isRecurring: 1 });
transactionSchema.index({ tags: 1 });
transactionSchema.index({ isGroupExpense: 1 });                    // ← NEW
transactionSchema.index({ 'groupExpenseMeta.groupId': 1 });        // ← NEW

// Virtual: formatted amount
transactionSchema.virtual('formattedAmount').get(function () {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: this.currency || 'INR',
  }).format(this.amount);
});

// Soft delete
transactionSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// Only return non-deleted by default
transactionSchema.pre(/^find/, function () {
  if (!this.getOptions().includeDeleted) {
    this.where({ isDeleted: false });
  }
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;